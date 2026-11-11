import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  Supplier,
  SupplierDocument,
  SupplierModelConstants,
  SupplierSchemaName,
} from '../models/supplier.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';
import { SyncService } from '../sync/sync.service';
import { PaymentTermsService } from '../payment-terms/payment-terms.service';
import { PaymentTermModelConstants } from 'src/models/payment-terms.schema';

@Injectable()
export class SupplierService extends GenericDatabase<Model<SupplierDocument>> {
  constructor(
    @InjectModel(SupplierSchemaName)
    private readonly supplierModel: Model<SupplierDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly syncService: SyncService,
    private readonly paymentTermsService: PaymentTermsService,
  ) {
    super(supplierModel);
  }

  async createSupplier(
    dto: CreateSupplierDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      if (!dto.paymentTermsId) {
        throw new BadRequestException('Payment term is required');
      }

      const paymentTerm = await this.paymentTermsService.genericFindOne({
        _id: new Types.ObjectId(dto.paymentTermsId),
      });

      if (!paymentTerm) {
        throw new BadRequestException('Invalid or non-existent payment term');
      }

      if (dto.phone) {
        const dupPhone = await this.supplierModel.findOne({
          companyId: new Types.ObjectId(dto.companyId),
          phone: dto.phone.trim(),
          isDeleted: false,
        });

        if (dupPhone) {
          throw new BadRequestException(
            `A supplier with phone number '${dto.phone.trim()}' already exists in your store`,
          );
        }
      }

      const created = await this.genericCreateOne({
        ...dto,
        name: dto.name.trim(),
        contactPerson: dto.contactPerson?.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.toLowerCase().trim(),
        taxPercentage: dto.taxPercentage?.trim(),
        address: dto.address?.trim(),
        balanceDue: dto.balanceDue ?? 0,
        gstinNumber: dto.gstinNumber?.trim(),
        paymentTermsId: new Types.ObjectId(dto.paymentTermsId),
        companyId: new Types.ObjectId(dto.companyId),
        isActive: dto.isActive ?? true,
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SUPPLIER,
        entityType: LogEntityType.SUPPLIER,
        entityId: new Types.ObjectId(created._id),
        description: `Supplier ${created.name} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: 'Supplier created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SUPPLIER,
        entityType: LogEntityType.SUPPLIER,
        entityId: new Types.ObjectId(),
        description: `Failed to create supplier`,
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
      throw new BadRequestException('Error creating supplier');
    }
  }

  async findAllSuppliers(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    search?: string,
    isActive?: boolean,
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

      if (isActive !== undefined && isActive !== null) {
        filter.isActive = String(isActive) === 'true';
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { contactPerson: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.supplierModel
          .find(filter)
          .populate({
            path: SupplierModelConstants.paymentTermsId,
            select: `${PaymentTermModelConstants.name} ${PaymentTermModelConstants.type} ${PaymentTermModelConstants.numberOfDays}`,
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.supplierModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Suppliers fetched successfully',
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
      throw new BadRequestException('Error fetching suppliers');
    }
  }

  async findOneSupplier(
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

      const supplier = await this.supplierModel.findOne(filter).populate({
        path: SupplierModelConstants.paymentTermsId,
        select: `${PaymentTermModelConstants.name} ${PaymentTermModelConstants.type} ${PaymentTermModelConstants.numberOfDays}`,
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      return {
        success: true,
        message: 'Supplier fetched successfully',
        data: supplier,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching supplier');
    }
  }

  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const supplier = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      if (dto.paymentTermsId) {
        const paymentTerm = await this.paymentTermsService.genericFindOne({
          _id: new Types.ObjectId(dto.paymentTermsId),
        });

        if (!paymentTerm) {
          throw new BadRequestException('Invalid or non-existent payment term');
        }
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.contactPerson !== undefined && {
          contactPerson: dto.contactPerson?.trim(),
        }),
        ...(dto.phone && { phone: dto.phone.trim() }),
        ...(dto.email !== undefined && {
          email: dto.email?.toLowerCase().trim(),
        }),
        ...(dto.taxPercentage !== undefined && {
          taxPercentage: dto.taxPercentage,
        }),
        ...(dto.address !== undefined && { address: dto.address?.trim() }),
        ...(dto.gstinNumber !== undefined && {
          gstinNumber: dto.gstinNumber?.trim(),
        }),
        ...(dto.paymentTermsId && {
          paymentTermsId: new Types.ObjectId(dto.paymentTermsId),
        }),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUPPLIER,
        entityType: LogEntityType.SUPPLIER,
        entityId: new Types.ObjectId(id),
        description: `Supplier ${updated?.name} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: 'Supplier updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUPPLIER,
        entityType: LogEntityType.SUPPLIER,
        entityId: new Types.ObjectId(id),
        description: `Failed to update supplier`,
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
      throw new BadRequestException('Error updating supplier');
    }
  }

  async deleteSupplier(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const supplier = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_SUPPLIER,
        entityType: LogEntityType.SUPPLIER,
        entityId: new Types.ObjectId(id),
        description: `Supplier ${supplier.name} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Supplier deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_SUPPLIER,
        entityType: LogEntityType.SUPPLIER,
        entityId: new Types.ObjectId(id),
        description: `Failed to delete supplier`,
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
      throw new BadRequestException('Error deleting supplier');
    }
  }
}
