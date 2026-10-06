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
  Purchase,
  PurchaseDocument,
  PurchaseItem,
  PurchaseSchemaName,
} from '../models/purchase.schema';
import { ProductDocument, ProductSchemaName } from '../models/product.schema';
import { SupplierDocument, SupplierSchemaName } from '../models/supplier.schema';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class PurchaseService extends GenericDatabase<Model<PurchaseDocument>> {
  constructor(
    @InjectModel(PurchaseSchemaName)
    private readonly purchaseModel: Model<PurchaseDocument>,
    @InjectModel(ProductSchemaName)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(SupplierSchemaName)
    private readonly supplierModel: Model<SupplierDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {
    super(purchaseModel);
  }

  async createPurchase(
    dto: CreatePurchaseDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const supplier = await this.supplierModel.findOne({
        _id: dto.supplierId,
        companyId: new Types.ObjectId(dto.companyId),
        isDeleted: false,
      });

      if (!supplier) {
        throw new BadRequestException('Supplier not found for this company');
      }

      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException(
          'Purchase must contain at least one item',
        );
      }

      return await this.runTransaction(async (session: ClientSession) => {
        let totalAmount = 0;
        const preparedItems: PurchaseItem[] = [];

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

          const totalCost = itemDto.costPrice * itemDto.quantity;
          totalAmount += totalCost;

          preparedItems.push({
            productId: new Types.ObjectId(itemDto.productId),
            productName: product.name,
            quantity: itemDto.quantity,
            costPrice: itemDto.costPrice,
            totalCost,
          });
        }

        const dueAmount = Math.max(0, totalAmount - dto.paidAmount);

        const created = await this.genericCreateOne(
          {
            ...dto,
            billNumber: dto.billNumber.trim(),
            supplierId: new Types.ObjectId(dto.supplierId),
            items: preparedItems,
            totalAmount,
            paidAmount: dto.paidAmount,
            dueAmount,
            purchaseDate: dto.purchaseDate
              ? new Date(dto.purchaseDate)
              : new Date(),
            companyId: new Types.ObjectId(dto.companyId),
            notes: dto.notes?.trim(),
            createdBy: new Types.ObjectId(userId),
          },
          { session },
        );

        for (const item of preparedItems) {
          await this.productModel.updateOne(
            { _id: item.productId },
            {
              $inc: { stockQuantity: item.quantity },
              $set: { costPrice: item.costPrice },
            },
            { session },
          );
        }

        if (dueAmount > 0) {
          await this.supplierModel.updateOne(
            { _id: dto.supplierId },
            { $inc: { balanceDue: dueAmount } },
            { session },
          );
        }

        await this.logService.createLog({
          companyId: new Types.ObjectId(dto.companyId),
          createdBy: new Types.ObjectId(userId),
          action: LogActions.CREATE_PURCHASE,
          entityType: LogEntityType.PURCHASE,
          entityId: new Types.ObjectId(created._id),
          description: `Purchase Bill ${created.billNumber} created`,
          ipAddress,
          path: req.url,
          status: LogStatus.SUCCESS,
        });

        return {
          success: true,
          message: 'Purchase created and stock updated successfully',
          data: created,
          statusCode: HttpStatus.CREATED,
        };
      });
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_PURCHASE,
        entityType: LogEntityType.PURCHASE,
        entityId: new Types.ObjectId(),
        description: `Failed to create purchase`,
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
      throw new BadRequestException('Error creating purchase');
    }
  }

  async findAllPurchases(
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
        filter.billNumber = { $regex: search, $options: 'i' };
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.purchaseModel
          .find(filter)
          .populate('supplierId', 'name phone contactPerson taxId')
          .populate('createdBy', 'username name')
          .populate('items.productId', 'name sku barcode unitOfMeasure')
          .sort({ purchaseDate: -1 })
          .skip(skip)
          .limit(limit),
        this.purchaseModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Purchases fetched successfully',
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
      throw new BadRequestException('Error fetching purchases');
    }
  }

  async findOnePurchase(
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

      const purchase = await this.purchaseModel
        .findOne(filter)
        .populate('supplierId', 'name phone contactPerson taxId')
        .populate('createdBy', 'username name')
        .populate('items.productId', 'name sku barcode unitOfMeasure');

      if (!purchase) {
        throw new NotFoundException('Purchase bill not found');
      }

      return {
        success: true,
        message: 'Purchase fetched successfully',
        data: purchase,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching purchase');
    }
  }
}
