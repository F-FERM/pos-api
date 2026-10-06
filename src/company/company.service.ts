import {
  BadRequestException,
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  Company,
  CompanyDocument,
  CompanyModelConstants,
  CompanySchemaName,
} from '../models/company.schema';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UserService } from '../user/user.service';
import { LogService } from '../log/log.service';
import { NumberSettingsService } from '../number-settings/number-settings.service';
import { CounterService } from '../counter/counter.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';
import { UserDocument, UserModelConstants } from '../models/user.schema';

@Injectable()
export class CompanyService extends GenericDatabase<Model<CompanyDocument>> {
  constructor(
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly logService: LogService,
    private readonly numberSettingsService: NumberSettingsService,
    private readonly counterService: CounterService,
  ) {
    super(companyModel);
  }

  async validateCompany(
    companyId: string,
    userId?: string,
  ): Promise<CompanyDocument> {
    try {
      if (!this.isValidMongoId(companyId)) {
        throw new BadRequestException('Invalid company id');
      }
      if (userId && !this.isValidMongoId(userId)) {
        throw new BadRequestException('Invalid user id');
      }

      if (userId) {
        await this.userService.validateAuthenticatedUser(userId);
      }
      const company = await this.genericFindOne({ _id: companyId });
      if (!company) {
        throw new NotFoundException('Company not found');
      }
      return company;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error validating company');
    }
  }

  async createCompany(
    dto: CreateCompanyDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const exists: CompanyDocument | null = await this.genericFindOne({
        $or: [
          { [CompanyModelConstants.code]: dto.code.toUpperCase() },
          { [CompanyModelConstants.slug]: dto.slug.toLowerCase() },
        ],
      });
      if (exists) {
        throw new BadRequestException('Company code or slug already exists');
      }

      const created: CompanyDocument = await this.genericCreateOne({
        ...dto,
        [CompanyModelConstants.code]: dto.code.toUpperCase(),
        [CompanyModelConstants.slug]: dto.slug.toLowerCase(),
        [CompanyModelConstants.ownerId]: new Types.ObjectId(userId),
        [CompanyModelConstants.createdBy]: new Types.ObjectId(userId),
      });

      // Auto-create default number settings & default checkout counter for new company
      try {
        await this.numberSettingsService.createDefaultSettingsForCompany(
          created._id.toString(),
          userId,
        );
        await this.counterService.createDefaultCounterForCompany(
          created._id.toString(),
          userId,
        );
      } catch (initErr) {
        console.warn('Failed to auto-seed defaults for new company:', initErr);
      }

      await this.logService.createLog({
        companyId: new Types.ObjectId(created._id),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_COMPANY,
        entityType: LogEntityType.COMPANY,
        entityId: new Types.ObjectId(created._id),
        description: `Company ${created[CompanyModelConstants.name]} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Company created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_COMPANY,
        entityType: LogEntityType.COMPANY,
        entityId: new Types.ObjectId(),
        description: `Failed to create company`,
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown',
        },
      });
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error creating company');
    }
  }

  async findAllCompanies(
    userId: string,
    roles: string[],
    page: number,
    limit: number,
    search?: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin: boolean = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = {
        [CompanyModelConstants.isDeleted]: false,
      };

      if (!isSuperAdmin) {
        const user = await this.userService.genericFindOne({ _id: userId });
        const userCompanyId = user?.[UserModelConstants.companyId];
        if (!userCompanyId) {
          throw new BadRequestException('No company scope for this user');
        }
        filter._id = userCompanyId;
      }

      if (search) {
        filter[CompanyModelConstants.name] = {
          $regex: search,
          $options: 'i',
        };
      }

      const skip: number = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.companyModel
          .find(filter)
          .populate('ownerId', 'username name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.companyModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Companies fetched successfully',
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
      throw new BadRequestException('Error fetching companies');
    }
  }

  async findOneCompany(id: string, userId: string, roles: string[]) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin: boolean = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = { _id: id };

      if (!isSuperAdmin) {
        const user = await this.userService.genericFindOne({ _id: userId });
        const userCompanyId = user?.[UserModelConstants.companyId];
        if (!userCompanyId || userCompanyId.toString() !== id) {
          throw new BadRequestException('Access denied');
        }
      }

      const company = await this.companyModel
        .findOne(filter)
        .populate('ownerId', 'username name email');
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      return {
        success: true,
        message: 'Company fetched successfully',
        data: company,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching company');
    }
  }

  async updateCompany(
    id: string,
    dto: UpdateCompanyDto,
    userId: string,
    roles: string[],
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin: boolean = roles.includes(Role.superadmin);

      if (!isSuperAdmin) {
        const userCompanyId = user?.[UserModelConstants.companyId];
        if (!userCompanyId || userCompanyId.toString() !== id) {
          throw new BadRequestException('Access denied');
        }
      }

      const company: CompanyDocument | null = await this.genericFindOne({
        _id: id,
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      const updated: CompanyDocument | null = await this.genericUpdateOne(id, {
        ...dto,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(id),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_COMPANY,
        entityType: LogEntityType.COMPANY,
        entityId: new Types.ObjectId(id),
        description: `Company ${updated?.[CompanyModelConstants.name]} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Company updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(id),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_COMPANY,
        entityType: LogEntityType.COMPANY,
        entityId: new Types.ObjectId(id),
        description: `Failed to update company`,
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown',
        },
      });
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating company');
    }
  }

  async deleteCompany(id: string, userId: string, req: AuthedRequest) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const company: CompanyDocument | null = await this.genericFindOne({
        _id: id,
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      await this.genericUpdateOne(id, {
        [CompanyModelConstants.isDeleted]: true,
        [CompanyModelConstants.deletedAt!]: new Date(),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(id),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_COMPANY,
        entityType: LogEntityType.COMPANY,
        entityId: new Types.ObjectId(id),
        description: `Company ${company[CompanyModelConstants.name]} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Company deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(id),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_COMPANY,
        entityType: LogEntityType.COMPANY,
        entityId: new Types.ObjectId(id),
        description: `Failed to delete company`,
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown',
        },
      });
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error deleting company');
    }
  }
}
