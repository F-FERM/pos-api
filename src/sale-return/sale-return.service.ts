import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  SaleReturn,
  SaleReturnDocument,
  SaleReturnItem,
  SaleReturnModelConstants,
  SaleReturnSchemaName,
} from '../models/sale-return.schema';
import {
  SaleDocument,
  SaleModelConstants,
  SaleSchemaName,
  SaleStatus,
} from '../models/sale.schema';
import {
  ProductDocument,
  ProductModelConstants,
  ProductSchemaName,
} from '../models/product.schema';
import {
  CustomerDocument,
  CustomerModelConstants,
  CustomerSchemaName,
} from '../models/customer.schema';
import {
  RegisterSessionDocument,
  RegisterSessionSchemaName,
} from '../models/register-session.schema';
import { UserModelConstants } from '../models/user.schema';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { NumberSettingsService } from '../number-settings/number-settings.service';
import { AuthedRequest } from '../utils/common.types';
import {
  LogActions,
  LogEntityType,
  LogStatus,
  numberSettingsDocumentType,
  RefundMethod,
} from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class SaleReturnService extends GenericDatabase<
  Model<SaleReturnDocument>
> {
  constructor(
    @InjectModel(SaleReturnSchemaName)
    private readonly saleReturnModel: Model<SaleReturnDocument>,
    @InjectModel(SaleSchemaName)
    private readonly saleModel: Model<SaleDocument>,
    @InjectModel(ProductSchemaName)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(CustomerSchemaName)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(RegisterSessionSchemaName)
    private readonly registerModel: Model<RegisterSessionDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly numberSettingsService: NumberSettingsService,
  ) {
    super(saleReturnModel);
  }

  async createSaleReturn(
    dto: CreateSaleReturnDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const sale = await this.saleModel.findOne({
        _id: new Types.ObjectId(dto.saleId),
        companyId: new Types.ObjectId(dto.companyId),
        isDeleted: false,
      });

      if (!sale) {
        throw new NotFoundException('Original sale invoice not found');
      }

      if (sale.status !== SaleStatus.COMPLETED) {
        throw new BadRequestException(
          `Returns are only allowed for COMPLETED sales. Current sale status: ${sale.status}`,
        );
      }

      const existingReturns = await this.saleReturnModel.find({
        saleId: new Types.ObjectId(dto.saleId),
        companyId: new Types.ObjectId(dto.companyId),
        isDeleted: false,
      });

      const alreadyReturnedQtyMap = new Map<string, number>();
      for (const ret of existingReturns) {
        for (const it of ret.items) {
          const pId = it.productId.toString();
          alreadyReturnedQtyMap.set(
            pId,
            (alreadyReturnedQtyMap.get(pId) || 0) + it.quantity,
          );
        }
      }

      return await this.runTransaction(async (session: ClientSession) => {
        let subtotalRefund = 0;
        let taxRefund = 0;

        const preparedReturnItems: SaleReturnItem[] = [];

        for (const returnItemDto of dto.items) {
          const originalSaleItem = sale.items.find(
            (si) => si.productId.toString() === returnItemDto.productId,
          );

          if (!originalSaleItem) {
            throw new BadRequestException(
              `Product ID ${returnItemDto.productId} was not part of original sale invoice ${sale.invoiceNumber}`,
            );
          }

          const alreadyReturned =
            alreadyReturnedQtyMap.get(returnItemDto.productId) || 0;
          const maxReturnable = originalSaleItem.quantity - alreadyReturned;

          if (returnItemDto.quantity > maxReturnable) {
            throw new BadRequestException(
              `Cannot return ${returnItemDto.quantity} units of '${originalSaleItem.productName}'. Remaining returnable quantity: ${maxReturnable}`,
            );
          }

          const lineUnitPrice = originalSaleItem.unitPrice;
          const lineSubtotalRefund = lineUnitPrice * returnItemDto.quantity;
          const lineTaxRefund =
            (lineSubtotalRefund * (originalSaleItem.taxRate || 0)) / 100;
          const lineTotalRefund = lineSubtotalRefund + lineTaxRefund;

          subtotalRefund += lineSubtotalRefund;
          taxRefund += lineTaxRefund;

          preparedReturnItems.push({
            productId: new Types.ObjectId(returnItemDto.productId),
            productName: originalSaleItem.productName,
            quantity: returnItemDto.quantity,
            unitPrice: lineUnitPrice,
            refundAmount: lineTotalRefund,
            reason: returnItemDto.reason?.trim(),
          });
        }

        const totalRefundAmount = subtotalRefund + taxRefund;

        let returnNumber = `CN-${Date.now().toString().slice(-6)}`;
        try {
          returnNumber = await this.numberSettingsService.generateNumber(
            dto.companyId,
            userId,
            numberSettingsDocumentType.CREDIT_NOTE,
            session,
          );
        } catch {
          /* Fallback return number if setting is absent */
        }

        const createdReturn = await this.genericCreateOne(
          {
            returnNumber,
            saleId: new Types.ObjectId(dto.saleId),
            invoiceNumber: sale.invoiceNumber,
            items: preparedReturnItems,
            subtotalRefund,
            taxRefund,
            totalRefundAmount,
            refundMethod: dto.refundMethod,
            customerId: sale.customerId
              ? new Types.ObjectId(sale.customerId.toString())
              : null,
            registerSessionId: dto.registerSessionId
              ? new Types.ObjectId(dto.registerSessionId)
              : null,
            notes: dto.notes?.trim(),
            companyId: new Types.ObjectId(dto.companyId),
            createdBy: new Types.ObjectId(userId),
          },
          { session },
        );

        for (const retItem of preparedReturnItems) {
          await this.productModel.updateOne(
            { _id: retItem.productId },
            { $inc: { stockQuantity: retItem.quantity } },
            { session },
          );
        }

        if (sale.customerId) {
          const company = await this.companyService.genericFindOne(
            { _id: dto.companyId },
            { session },
          );
          const loyaltyRate = company?.regional?.loyaltyAmountPerPoint || 100;
          const loyaltyPointsToDeduct = totalRefundAmount / loyaltyRate;

          const customerInc: Record<string, number> = {
            loyaltyPoints: -loyaltyPointsToDeduct,
          };

          if (dto.refundMethod === RefundMethod.STORE_CREDIT) {
            customerInc.balanceDue = -totalRefundAmount;
          }

          await this.customerModel.updateOne(
            { _id: sale.customerId },
            { $inc: customerInc },
            { session },
          );
        }

        if (dto.registerSessionId && dto.refundMethod === RefundMethod.CASH) {
          await this.registerModel.updateOne(
            { _id: dto.registerSessionId },
            { $inc: { totalSalesCash: -totalRefundAmount } },
            { session },
          );
        }

        await this.logService.createLog({
          companyId: new Types.ObjectId(dto.companyId),
          createdBy: new Types.ObjectId(userId),
          action: LogActions.CREATE_SALE_RETURN,
          entityType: LogEntityType.SALE_RETURN,
          entityId: new Types.ObjectId(createdReturn._id),
          description: `Sale return / credit note ${createdReturn.returnNumber} processed for invoice ${sale.invoiceNumber} (Refund: ${totalRefundAmount})`,
          ipAddress,
          path: req.url,
          status: LogStatus.SUCCESS,
        });

        return {
          success: true,
          message: 'Sale return and refund processed successfully',
          data: createdReturn,
          statusCode: HttpStatus.CREATED,
        };
      });
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SALE_RETURN,
        entityType: LogEntityType.SALE_RETURN,
        entityId: new Types.ObjectId(),
        description: 'Failed to process sale return',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error processing sale return');
    }
  }

  async findAllSaleReturns(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    search?: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = {
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        await this.companyService.validateCompany(companyId, userId);
        filter.companyId = new Types.ObjectId(companyId);
      } else if (companyId) {
        filter.companyId = new Types.ObjectId(companyId);
      }

      if (search) {
        filter.$or = [
          { returnNumber: { $regex: search, $options: 'i' } },
          { invoiceNumber: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.saleReturnModel
          .find(filter)
          .populate([
            {
              path: SaleReturnModelConstants.saleId,
              select: `${SaleModelConstants.invoiceNumber} ${SaleModelConstants.grandTotal} createdAt`,
            },
            {
              path: SaleReturnModelConstants.customerId,
              select: `${CustomerModelConstants.name} ${CustomerModelConstants.phone} ${CustomerModelConstants.email}`,
            },
            {
              path: SaleReturnModelConstants.createdBy,
              select: `${UserModelConstants.username} ${UserModelConstants.name}`,
            },
            {
              path: 'items.productId',
              select: `${ProductModelConstants.name} ${ProductModelConstants.sku} ${ProductModelConstants.barcode} ${ProductModelConstants.unitOfMeasure}`,
            },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.saleReturnModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Sale returns fetched successfully',
        data,
        pagination: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching sale returns');
    }
  }

  async findOneSaleReturn(
    id: string,
    userId: string,
    companyId: string,
    roles: string[],
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = {
        _id: id,
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        filter.companyId = new Types.ObjectId(companyId);
      }

      const saleReturn = await this.saleReturnModel.findOne(filter).populate([
        {
          path: SaleReturnModelConstants.saleId,
          select: `${SaleModelConstants.invoiceNumber} ${SaleModelConstants.grandTotal} createdAt`,
        },
        {
          path: SaleReturnModelConstants.customerId,
          select: `${CustomerModelConstants.name} ${CustomerModelConstants.phone} ${CustomerModelConstants.email}`,
        },
        {
          path: SaleReturnModelConstants.createdBy,
          select: `${UserModelConstants.username} ${UserModelConstants.name}`,
        },
        {
          path: 'items.productId',
          select: `${ProductModelConstants.name} ${ProductModelConstants.sku} ${ProductModelConstants.barcode} ${ProductModelConstants.unitOfMeasure}`,
        },
      ]);

      if (!saleReturn) {
        throw new NotFoundException('Sale return record not found');
      }

      return {
        success: true,
        message: 'Sale return record fetched successfully',
        data: saleReturn,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching sale return record');
    }
  }

  async deleteSaleReturn(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const saleReturn = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!saleReturn) {
        throw new NotFoundException('Active sale return record not found');
      }

      return await this.runTransaction(async (session: ClientSession) => {
        // Reverse inventory stock addition (deduct returned stock back)
        for (const item of saleReturn.items) {
          await this.productModel.updateOne(
            { _id: item.productId },
            { $inc: { stockQuantity: -item.quantity } },
            { session },
          );
        }

        // Restore loyalty points & store credit
        if (saleReturn.customerId) {
          const company = await this.companyService.genericFindOne(
            { _id: companyId },
            { session },
          );
          const loyaltyRate = company?.regional?.loyaltyAmountPerPoint || 100;
          const loyaltyPointsToRestore =
            saleReturn.totalRefundAmount / loyaltyRate;

          const customerInc: Record<string, number> = {
            loyaltyPoints: loyaltyPointsToRestore,
          };

          if (saleReturn.refundMethod === RefundMethod.STORE_CREDIT) {
            customerInc.balanceDue = saleReturn.totalRefundAmount;
          }

          await this.customerModel.updateOne(
            { _id: saleReturn.customerId },
            { $inc: customerInc },
            { session },
          );
        }

        // Restore cash register session
        if (
          saleReturn.registerSessionId &&
          saleReturn.refundMethod === RefundMethod.CASH
        ) {
          await this.registerModel.updateOne(
            { _id: saleReturn.registerSessionId },
            { $inc: { totalSalesCash: saleReturn.totalRefundAmount } },
            { session },
          );
        }

        const updated = await this.genericUpdateOne(
          id,
          { isDeleted: true },
          { session },
        );

        await this.logService.createLog({
          companyId: new Types.ObjectId(companyId),
          createdBy: new Types.ObjectId(userId),
          action: LogActions.DELETE_SALE_RETURN,
          entityType: LogEntityType.SALE_RETURN,
          entityId: new Types.ObjectId(id),
          description: `Sale return ${saleReturn.returnNumber} cancelled/deleted and stock/loyalty points restored`,
          ipAddress,
          path: req.url,
          status: LogStatus.SUCCESS,
        });

        return {
          success: true,
          message:
            'Sale return cancelled and inventory/loyalty points restored successfully',
          data: updated,
          statusCode: HttpStatus.OK,
        };
      });
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_SALE_RETURN,
        entityType: LogEntityType.SALE_RETURN,
        entityId: new Types.ObjectId(id),
        description: 'Failed to delete sale return',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error deleting sale return');
    }
  }
}
