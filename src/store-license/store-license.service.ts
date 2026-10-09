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
  LicenseStatus,
  StoreLicenseDocument,
  StoreLicenseModelConstants,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import {
  CompanyDocument,
  CompanyModelConstants,
  CompanySchemaName,
} from '../models/company.schema';
import { CompanySubscriptionStatus } from '../utils/enums/company.enums';
import { UserModelConstants } from '../models/user.schema';
import { CreateStoreLicenseDto } from './dto/create-store-license.dto';
import { UpdateStoreLicenseDto } from './dto/update-store-license.dto';
import { LogService } from '../log/log.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';

@Injectable()
export class StoreLicenseService extends GenericDatabase<
  Model<StoreLicenseDocument>
> {
  constructor(
    @InjectModel(StoreLicenseSchemaName)
    private readonly licenseModel: Model<StoreLicenseDocument>,
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly logService: LogService,
    private readonly userService: UserService,
  ) {
    super(licenseModel);
  }

  async createLicense(
    dto: CreateStoreLicenseDto,
    superAdminId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(superAdminId);

      const generatedKey =
        dto.licenseKey?.trim().toUpperCase() ||
        `LIC-STORE-${Math.floor(100000 + Math.random() * 900000)}`;

      const existing = await this.licenseModel.findOne({
        licenseKey: generatedKey,
        isDeleted: false,
      });

      if (existing) {
        throw new BadRequestException('Store license key already exists');
      }

      const created = await this.genericCreateOne({
        ...dto,
        licenseKey: generatedKey,
        assignedEmail: dto.assignedEmail?.trim().toLowerCase(),
        status: dto.assignedEmail
          ? LicenseStatus.ASSIGNED
          : dto.status || LicenseStatus.UNASSIGNED,
        maxCounters: dto.maxCounters || 5,
        maxUsers: dto.maxUsers || 10,
        validityMonths: dto.validityMonths || 12,
        createdBy: new Types.ObjectId(superAdminId),
      });

      await this.logService.createLog({
        companyId: null,
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.CREATE_STORE_LICENSE,
        entityType: LogEntityType.STORE_LICENSE,
        entityId: new Types.ObjectId(created._id),
        description: `Superadmin created Store License Key '${created.licenseKey}'`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Store license key generated successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error generating store license key');
    }
  }

  async findAllLicenses(
    page: number,
    limit: number,
    status?: LicenseStatus,
    search?: string,
  ) {
    try {
      const filter: Record<string, unknown> = {
        isDeleted: false,
      };

      if (status) {
        filter.status = status;
      }

      if (search) {
        filter.$or = [
          { licenseKey: { $regex: search, $options: 'i' } },
          { assignedEmail: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.licenseModel
          .find(filter)
          .populate([
            {
              path: StoreLicenseModelConstants.companyId,
              select: `${CompanyModelConstants.name} ${CompanyModelConstants.code} ${CompanyModelConstants.slug}`,
            },
            {
              path: StoreLicenseModelConstants.createdBy,
              select: `${UserModelConstants.username} ${UserModelConstants.name}`,
            },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.licenseModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Store licenses fetched successfully',
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
      throw new BadRequestException('Error fetching store licenses');
    }
  }

  async findOneLicense(id: string) {
    try {
      const license = await this.licenseModel
        .findOne({ _id: id, isDeleted: false })
        .populate([
          {
            path: StoreLicenseModelConstants.companyId,
            select: `${CompanyModelConstants.name} ${CompanyModelConstants.code} ${CompanyModelConstants.slug}`,
          },
          {
            path: StoreLicenseModelConstants.createdBy,
            select: `${UserModelConstants.username} ${UserModelConstants.name}`,
          },
        ]);

      if (!license) {
        throw new NotFoundException('Store license key not found');
      }

      return {
        success: true,
        message: 'Store license details fetched successfully',
        data: license,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching store license details');
    }
  }

  async updateLicense(
    id: string,
    dto: UpdateStoreLicenseDto,
    superAdminId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(superAdminId);

      const license = await this.genericFindOne({ _id: id });
      if (!license) {
        throw new NotFoundException('Store license key not found');
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.assignedEmail && {
          assignedEmail: dto.assignedEmail.trim().toLowerCase(),
        }),
      });

      // Sync company subscription if companyId is linked
      if (license.companyId) {
        const compStatus =
          dto.status === LicenseStatus.SUSPENDED
            ? CompanySubscriptionStatus.SUSPENDED
            : dto.status === LicenseStatus.EXPIRED
              ? CompanySubscriptionStatus.EXPIRED
              : dto.isTrial === true ||
                  (dto.isTrial === undefined && license.isTrial)
                ? CompanySubscriptionStatus.TRIAL
                : CompanySubscriptionStatus.ACTIVE;

        await this.companyModel.updateOne(
          { _id: license.companyId },
          {
            $set: {
              'subscription.status': compStatus,
              ...(dto.expiresAt && { 'subscription.endDate': dto.expiresAt }),
            },
          },
        );
      }

      await this.logService.createLog({
        companyId: license.companyId
          ? new Types.ObjectId(license.companyId)
          : null,
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.UPDATE_STORE_LICENSE,
        entityType: LogEntityType.STORE_LICENSE,
        entityId: new Types.ObjectId(id),
        description: `Superadmin updated Store License Key '${license.licenseKey}'`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Store license details updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating store license');
    }
  }

  async deleteLicense(id: string, superAdminId: string, req: AuthedRequest) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(superAdminId);

      const license = await this.genericFindOne({ _id: id });
      if (!license) {
        throw new NotFoundException('Store license key not found');
      }

      const deleted = await this.genericUpdateOne(id, {
        isDeleted: true,
        status: LicenseStatus.SUSPENDED,
      });

      await this.logService.createLog({
        companyId: license.companyId
          ? new Types.ObjectId(license.companyId)
          : null,
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.DELETE_STORE_LICENSE,
        entityType: LogEntityType.STORE_LICENSE,
        entityId: new Types.ObjectId(id),
        description: `Superadmin deleted Store License Key '${license.licenseKey}'`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Store license key deleted successfully',
        data: deleted,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error deleting store license');
    }
  }
}
