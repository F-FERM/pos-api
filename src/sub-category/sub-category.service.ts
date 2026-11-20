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
  SubCategory,
  SubCategoryDocument,
  SubCategoryModelConstants,
  SubCategorySchemaName,
} from '../models/sub-category.schema';
import { CategoryModelConstants } from '../models/category.schema';
import { CategoryService } from '../category/category.service';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { SyncService } from '../sync/sync.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class SubCategoryService extends GenericDatabase<
  Model<SubCategoryDocument>
> {
  constructor(
    @InjectModel(SubCategorySchemaName)
    private readonly subCategoryModel: Model<SubCategoryDocument>,
    private readonly categoryService: CategoryService,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly syncService: SyncService,
  ) {
    super(subCategoryModel);
  }

  async createSubCategory(
    dto: CreateSubCategoryDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const category = await this.categoryService.genericFindOne({
        _id: dto.categoryId,
        companyId: new Types.ObjectId(dto.companyId),
      });

      if (!category) {
        throw new BadRequestException(
          'Main Category not found for this company',
        );
      }

      const existing = await this.genericFindOne({
        companyId: new Types.ObjectId(dto.companyId),
        categoryId: new Types.ObjectId(dto.categoryId),
        name: { $regex: `^${dto.name.trim()}$`, $options: 'i' },
      });

      if (existing) {
        throw new BadRequestException(
          'Sub-category with this name already exists under this main category',
        );
      }

      const created = await this.genericCreateOne({
        name: dto.name.trim(),
        code: dto.code?.trim(),
        description: dto.description?.trim(),
        categoryId: new Types.ObjectId(dto.categoryId),
        companyId: new Types.ObjectId(dto.companyId),
        isActive: dto.isActive ?? true,
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SUB_CATEGORY,
        entityType: LogEntityType.SUB_CATEGORY,
        entityId: new Types.ObjectId(created._id),
        description: `Sub-category ${created.name} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: 'Sub-category created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SUB_CATEGORY,
        entityType: LogEntityType.SUB_CATEGORY,
        entityId: new Types.ObjectId(),
        description: `Failed to create sub-category`,
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
      throw new BadRequestException('Error creating sub-category');
    }
  }

  async findAllSubCategories(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    req: AuthedRequest,
    categoryId?: string,
    search?: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);
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

      if (categoryId) {
        filter.categoryId = new Types.ObjectId(categoryId);
      }

      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.subCategoryModel
          .find(filter)
          .populate([
            {
              path: SubCategoryModelConstants.categoryId,
              select: `${CategoryModelConstants.name} ${CategoryModelConstants.code}`,
            },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.subCategoryModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Sub-categories fetched successfully',
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
      throw new BadRequestException('Error fetching sub-categories');
    }
  }

  async findOneSubCategory(
    id: string,
    userId: string,
    companyId: string,
    roles: string[],
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);
      const isSuperAdmin = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = {
        _id: id,
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        filter.companyId = new Types.ObjectId(companyId);
      }

      const subCategory = await this.subCategoryModel.findOne(filter).populate([
        {
          path: SubCategoryModelConstants.categoryId,
          select: `${CategoryModelConstants.name} ${CategoryModelConstants.code}`,
        },
      ]);

      if (!subCategory) {
        throw new NotFoundException('Sub-category not found');
      }

      return {
        success: true,
        message: 'Sub-category fetched successfully',
        data: subCategory,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching sub-category');
    }
  }

  async updateSubCategory(
    id: string,
    dto: UpdateSubCategoryDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const subCategory = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!subCategory) {
        throw new NotFoundException('Sub-category not found');
      }

      if (dto.categoryId) {
        const category = await this.categoryService.genericFindOne({
          _id: dto.categoryId,
          companyId: new Types.ObjectId(companyId),
        });
        if (!category) {
          throw new BadRequestException(
            'Main Category not found for this company',
          );
        }
      }

      const updated = await this.genericUpdateOne(id, {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.code !== undefined && { code: dto.code?.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
        ...(dto.categoryId !== undefined && {
          categoryId: new Types.ObjectId(dto.categoryId),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUB_CATEGORY,
        entityType: LogEntityType.SUB_CATEGORY,
        entityId: new Types.ObjectId(id),
        description: `Sub-category ${updated?.name} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Sub-category updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUB_CATEGORY,
        entityType: LogEntityType.SUB_CATEGORY,
        entityId: new Types.ObjectId(id),
        description: `Failed to update sub-category`,
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
      throw new BadRequestException('Error updating sub-category');
    }
  }

  async deleteSubCategory(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const subCategory = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!subCategory) {
        throw new NotFoundException('Sub-category not found');
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_SUB_CATEGORY,
        entityType: LogEntityType.SUB_CATEGORY,
        entityId: new Types.ObjectId(id),
        description: `Sub-category ${subCategory.name} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Sub-category deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_SUB_CATEGORY,
        entityType: LogEntityType.SUB_CATEGORY,
        entityId: new Types.ObjectId(id),
        description: `Failed to delete sub-category`,
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
      throw new BadRequestException('Error deleting sub-category');
    }
  }
}
