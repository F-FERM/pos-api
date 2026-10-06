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
  PaymentMethod,
  Sale,
  SaleDocument,
  SaleItem,
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
  RegisterSessionModelConstants,
  RegisterSessionSchemaName,
} from '../models/register-session.schema';
import { UserModelConstants } from '../models/user.schema';
import { CreateSaleDto } from './dto/create-sale.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { NumberSettingsService } from '../number-settings/number-settings.service';
import { PrinterService } from '../printer/printer.service';
import { LoyaltySettingService } from '../loyalty-setting/loyalty-setting.service';
import { AuthedRequest } from '../utils/common.types';
import {
  LogActions,
  LogEntityType,
  LogStatus,
  numberSettingsDocumentType,
} from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class SaleService extends GenericDatabase<Model<SaleDocument>> {
  constructor(
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
    private readonly printerService: PrinterService,
    private readonly loyaltySettingService: LoyaltySettingService,
  ) {
    super(saleModel);
  }

  async createSale(
    dto: CreateSaleDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Sale must contain at least one item');
      }

      const saleStatus = dto.status || SaleStatus.COMPLETED;

      const saleResult = await this.runTransaction(
        async (session: ClientSession) => {
          let subtotal = 0;
          let discountTotal = 0;
          let taxTotal = 0;

          const preparedItems: SaleItem[] = [];

          for (const itemDto of dto.items) {
            const product = await this.productModel
              .findOne({
                _id: itemDto.productId,
                companyId: new Types.ObjectId(dto.companyId),
                isDeleted: false,
              })
              .session(session);

            if (!product) {
              throw new BadRequestException(
                `Product with ID ${itemDto.productId} not found`,
              );
            }

            if (
              saleStatus === SaleStatus.COMPLETED &&
              product.stockQuantity < itemDto.quantity
            ) {
              throw new BadRequestException(
                `Insufficient stock for product '${product.name}'. Available: ${product.stockQuantity}`,
              );
            }

            const lineSubtotal = itemDto.unitPrice * itemDto.quantity;
            const lineDiscount = itemDto.discountAmount || 0;
            const netLine = Math.max(0, lineSubtotal - lineDiscount);
            const lineTaxRate = itemDto.taxRate || product.taxRate || 0;
            const lineTax = (netLine * lineTaxRate) / 100;
            const lineTotal = netLine + lineTax;

            subtotal += lineSubtotal;
            discountTotal += lineDiscount;
            taxTotal += lineTax;

            preparedItems.push({
              productId: new Types.ObjectId(itemDto.productId),
              productName: product.name,
              quantity: itemDto.quantity,
              unitPrice: itemDto.unitPrice,
              discountAmount: lineDiscount,
              taxRate: lineTaxRate,
              taxAmount: lineTax,
              totalAmount: lineTotal,
            });
          }

          const loyaltySettingRes =
            await this.loyaltySettingService.getSetting(dto.companyId);
          const loyaltyConfig = loyaltySettingRes.data;

          let loyaltyPointsRedeemed = 0;
          let loyaltyDiscountAmount = 0;

          if (dto.redeemLoyaltyPoints && dto.redeemLoyaltyPoints > 0) {
            if (!dto.customerId) {
              throw new BadRequestException(
                'Customer ID is required to redeem loyalty points',
              );
            }

            if (loyaltyConfig && !loyaltyConfig.isEnabled) {
              throw new BadRequestException(
                'Store loyalty program is currently disabled',
              );
            }

            const customer = await this.customerModel
              .findOne({
                _id: dto.customerId,
                companyId: new Types.ObjectId(dto.companyId),
                isDeleted: false,
              })
              .session(session);

            if (!customer) {
              throw new BadRequestException(
                'Customer not found for loyalty redemption',
              );
            }

            const minPoints =
              loyaltyConfig?.minLoyaltyPointsToRedeem ?? 50;
            const pointValue =
              loyaltyConfig?.loyaltyPointMonetaryValue ?? 1;

            if (customer.loyaltyPoints < minPoints) {
              throw new BadRequestException(
                `Customer must have at least ${minPoints} loyalty points to redeem. Current balance: ${customer.loyaltyPoints}`,
              );
            }

            if (dto.redeemLoyaltyPoints > customer.loyaltyPoints) {
              throw new BadRequestException(
                `Cannot redeem ${dto.redeemLoyaltyPoints} points. Available loyalty balance: ${customer.loyaltyPoints}`,
              );
            }

            loyaltyPointsRedeemed = dto.redeemLoyaltyPoints;
            loyaltyDiscountAmount = loyaltyPointsRedeemed * pointValue;
            discountTotal += loyaltyDiscountAmount;
          }

          const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal);
          const changeAmount =
            dto.paidAmount > grandTotal ? dto.paidAmount - grandTotal : 0;

          const invoiceNumber =
            await this.numberSettingsService.generateNumber(
              dto.companyId,
              userId,
              numberSettingsDocumentType.INVOICE,
              session,
            );

          const created = await this.genericCreateOne(
            {
              ...dto,
              invoiceNumber,
              items: preparedItems,
              subtotal,
              discountTotal,
              taxTotal,
              loyaltyPointsRedeemed,
              loyaltyDiscountAmount,
              grandTotal,
              paidAmount: dto.paidAmount,
              changeAmount,
              paymentMethod: dto.paymentMethod,
              customerId: dto.customerId
                ? new Types.ObjectId(dto.customerId)
                : null,
              registerSessionId: dto.registerSessionId
                ? new Types.ObjectId(dto.registerSessionId)
                : null,
              status: saleStatus,
              companyId: new Types.ObjectId(dto.companyId),
              notes: dto.notes?.trim(),
              createdBy: new Types.ObjectId(userId),
            },
            { session },
          );

          if (saleStatus === SaleStatus.COMPLETED) {
            for (const item of preparedItems) {
              await this.productModel.updateOne(
                { _id: item.productId },
                { $inc: { stockQuantity: -item.quantity } },
                { session },
              );
            }

            if (dto.customerId) {
              const loyaltyRate =
                loyaltyConfig?.loyaltyAmountPerPoint || 100;
              const earnedLoyaltyPoints =
                loyaltyConfig?.isEnabled !== false
                  ? grandTotal / loyaltyRate
                  : 0;
              const loyaltyPointsDelta =
                earnedLoyaltyPoints - loyaltyPointsRedeemed;

              const customerInc: Record<string, number> = {
                loyaltyPoints: loyaltyPointsDelta,
              };

              if (dto.paymentMethod === PaymentMethod.CREDIT) {
                customerInc.balanceDue = grandTotal;
              }

              await this.customerModel.updateOne(
                { _id: dto.customerId },
                { $inc: customerInc },
                { session },
              );
            }

            if (dto.registerSessionId) {
              const registerInc: Record<string, number> = {};
              if (dto.paymentMethod === PaymentMethod.CASH) {
                registerInc.totalSalesCash = grandTotal;
              } else if (dto.paymentMethod === PaymentMethod.CARD) {
                registerInc.totalSalesCard = grandTotal;
              } else {
                registerInc.totalSalesOther = grandTotal;
              }
              await this.registerModel.updateOne(
                { _id: dto.registerSessionId },
                { $inc: registerInc },
                { session },
              );
            }
          }

          await this.logService.createLog({
            companyId: new Types.ObjectId(dto.companyId),
            createdBy: new Types.ObjectId(userId),
            action: LogActions.CREATE_SALE,
            entityType: LogEntityType.SALE,
            entityId: new Types.ObjectId(created._id),
            description: `Sale ${created.invoiceNumber} processed (${saleStatus})`,
            ipAddress,
            path: req.url,
            status: LogStatus.SUCCESS,
          });

          return created;
        },
      );

      let printResult: any = null;
      if (saleStatus === SaleStatus.COMPLETED) {
        try {
          const populatedSale = await this.saleModel
            .findById(saleResult._id)
            .populate([
              {
                path: SaleModelConstants.customerId,
                select: `${CustomerModelConstants.name} ${CustomerModelConstants.phone} ${CustomerModelConstants.email} ${CustomerModelConstants.loyaltyPoints}`,
              },
            ]);

          printResult = await this.printerService.printSaleReceipt(
            populatedSale?.toObject() || saleResult.toObject(),
            dto.companyId,
            dto.counterId,
            false,
          );
        } catch (printError) {
          console.error('Thermal printing error during sale:', printError);
        }
      }

      return {
        success: true,
        message:
          saleStatus === SaleStatus.COMPLETED
            ? 'Sale completed and printed successfully'
            : 'Sale saved / held successfully',
        data: {
          sale: saleResult,
          print: printResult,
        },
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SALE,
        entityType: LogEntityType.SALE,
        entityId: new Types.ObjectId(),
        description: `Failed to create sale`,
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
      throw new BadRequestException('Error processing sale');
    }
  }

  async reprintSale(
    id: string,
    counterId: string | undefined,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const sale = await this.saleModel
        .findOne({
          _id: new Types.ObjectId(id),
          companyId: new Types.ObjectId(companyId),
          isDeleted: false,
        })
        .populate([
          {
            path: SaleModelConstants.customerId,
            select: `${CustomerModelConstants.name} ${CustomerModelConstants.phone} ${CustomerModelConstants.email} ${CustomerModelConstants.loyaltyPoints}`,
          },
        ]);

      if (!sale) {
        throw new NotFoundException('Sale record not found');
      }

      const printResult = await this.printerService.printSaleReceipt(
        sale.toObject(),
        companyId,
        counterId,
        true,
      );

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.PRINT_SALE,
        entityType: LogEntityType.SALE,
        entityId: new Types.ObjectId(id),
        description: `Sale ${sale.invoiceNumber} reprinted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Sale receipt reprinted successfully',
        data: printResult,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.PRINT_SALE,
        entityType: LogEntityType.SALE,
        entityId: new Types.ObjectId(id),
        description: `Failed to reprint sale receipt`,
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
      throw new BadRequestException('Error re-printing sale receipt');
    }
  }

  async findAllSales(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    search?: string,
    status?: SaleStatus,
    paymentMethod?: PaymentMethod,
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

      if (status) {
        filter.status = status;
      }

      if (paymentMethod) {
        filter.paymentMethod = paymentMethod;
      }

      if (search) {
        filter.invoiceNumber = { $regex: search, $options: 'i' };
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.saleModel
          .find(filter)
          .populate([
            {
              path: SaleModelConstants.customerId,
              select: `${CustomerModelConstants.name} ${CustomerModelConstants.phone} ${CustomerModelConstants.email} ${CustomerModelConstants.loyaltyPoints} ${CustomerModelConstants.balanceDue}`,
            },
            {
              path: SaleModelConstants.registerSessionId,
              select: `${RegisterSessionModelConstants.openingCash} ${RegisterSessionModelConstants.status} ${RegisterSessionModelConstants.openedAt}`,
            },
            {
              path: SaleModelConstants.createdBy,
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
        this.saleModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Sales fetched successfully',
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
      throw new BadRequestException('Error fetching sales');
    }
  }

  async findOneSale(
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

      const sale = await this.saleModel.findOne(filter).populate([
        {
          path: SaleModelConstants.customerId,
          select: `${CustomerModelConstants.name} ${CustomerModelConstants.phone} ${CustomerModelConstants.email} ${CustomerModelConstants.address} ${CustomerModelConstants.loyaltyPoints} ${CustomerModelConstants.balanceDue}`,
        },
        {
          path: SaleModelConstants.registerSessionId,
          select: `${RegisterSessionModelConstants.openingCash} ${RegisterSessionModelConstants.status} ${RegisterSessionModelConstants.openedAt}`,
        },
        {
          path: SaleModelConstants.createdBy,
          select: `${UserModelConstants.username} ${UserModelConstants.name}`,
        },
        {
          path: 'items.productId',
          select: `${ProductModelConstants.name} ${ProductModelConstants.sku} ${ProductModelConstants.barcode} ${ProductModelConstants.unitOfMeasure}`,
        },
      ]);

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      return {
        success: true,
        message: 'Sale fetched successfully',
        data: sale,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching sale');
    }
  }

  async cancelSale(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const sale = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
        status: SaleStatus.COMPLETED,
      });

      if (!sale) {
        throw new NotFoundException('Completed sale not found');
      }

      return await this.runTransaction(async (session: ClientSession) => {
        for (const item of sale.items) {
          await this.productModel.updateOne(
            { _id: item.productId },
            { $inc: { stockQuantity: item.quantity } },
            { session },
          );
        }

        if (sale.customerId) {
          const loyaltySettingRes =
            await this.loyaltySettingService.getSetting(companyId);
          const loyaltyConfig = loyaltySettingRes.data;

          const loyaltyRate = loyaltyConfig?.loyaltyAmountPerPoint || 100;
          const pointsToDeduct = sale.grandTotal / loyaltyRate;

          const pointsRestored = sale.loyaltyPointsRedeemed || 0;
          const netPointsChange = -pointsToDeduct + pointsRestored;

          const customerInc: Record<string, number> = {
            loyaltyPoints: netPointsChange,
          };

          if (sale.paymentMethod === PaymentMethod.CREDIT) {
            customerInc.balanceDue = -sale.grandTotal;
          }

          await this.customerModel.updateOne(
            { _id: sale.customerId },
            { $inc: customerInc },
            { session },
          );
        }

        const updated = await this.genericUpdateOne(
          id,
          { status: SaleStatus.CANCELLED },
          { session },
        );

        await this.logService.createLog({
          companyId: new Types.ObjectId(companyId),
          createdBy: new Types.ObjectId(userId),
          action: LogActions.CANCEL_SALE,
          entityType: LogEntityType.SALE,
          entityId: new Types.ObjectId(id),
          description: `Sale ${sale.invoiceNumber} cancelled and stock/loyalty points restored`,
          ipAddress,
          path: req.url,
          status: LogStatus.SUCCESS,
        });

        return {
          success: true,
          message:
            'Sale cancelled and inventory/loyalty points restored successfully',
          data: updated,
          statusCode: HttpStatus.OK,
        };
      });
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CANCEL_SALE,
        entityType: LogEntityType.SALE,
        entityId: new Types.ObjectId(id),
        description: `Failed to cancel sale`,
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
      throw new BadRequestException('Error cancelling sale');
    }
  }
}
