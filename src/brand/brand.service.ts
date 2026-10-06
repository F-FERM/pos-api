import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import { Brand, BrandDocument, BrandSchemaName } from '../models/brand.schema';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class BrandService extends GenericDatabase<Model<BrandDocument>> {
  constructor(
    @InjectModel(BrandSchemaName)
    private readonly brandModel: Model<BrandDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {
    super(brandModel);
  }

  async createBrand(
    dto: CreateBrandDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const existing = await this.genericFindOne({
        companyId: new Types.ObjectId(dto.companyId),
        name: { $regex: `^${dto.name.trim()}$`, $options: 'i' },
      });

      if (existing) {
        throw new BadRequestException('Brand with this name already exists');
      }

      const created = await this.genericCreateOne({
        ...dto,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        companyId: new Types.ObjectId(dto.companyId),
        isActive: dto.isActive ?? true,
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_BRAND,
        entityType: LogEntityType.BRAND,
        entityId: new Types.ObjectId(created._id),
        description: `Brand ${created.name} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Brand created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_BRAND,
        entityType: LogEntityType.BRAND,
        entityId: new Types.ObjectId(),
        description: `Failed to create brand`,
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
      throw new BadRequestException('Error creating brand');
    }
  }

  async findAllBrands(
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
        filter.name = { $regex: search, $options: 'i' };
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.brandModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.brandModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Brands fetched successfully',
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
      throw new BadRequestException('Error fetching brands');
    }
  }

  async findOneBrand(
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

      const brand = await this.brandModel.findOne(filter);

      if (!brand) {
        throw new NotFoundException('Brand not found');
      }

      return {
        success: true,
        message: 'Brand fetched successfully',
        data: brand,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching brand');
    }
  }

  async updateBrand(
    id: string,
    dto: UpdateBrandDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const brand = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!brand) {
        throw new NotFoundException('Brand not found');
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_BRAND,
        entityType: LogEntityType.BRAND,
        entityId: new Types.ObjectId(id),
        description: `Brand ${updated?.name} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Brand updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_BRAND,
        entityType: LogEntityType.BRAND,
        entityId: new Types.ObjectId(id),
        description: `Failed to update brand`,
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
      throw new BadRequestException('Error updating brand');
    }
  }

  async deleteBrand(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const brand = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!brand) {
        throw new NotFoundException('Brand not found');
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_BRAND,
        entityType: LogEntityType.BRAND,
        entityId: new Types.ObjectId(id),
        description: `Brand ${brand.name} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Brand deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_BRAND,
        entityType: LogEntityType.BRAND,
        entityId: new Types.ObjectId(id),
        description: `Failed to delete brand`,
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
      throw new BadRequestException('Error deleting brand');
    }
  }
}
