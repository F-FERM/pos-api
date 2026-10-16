import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  UnitDocument,
  UnitModelConstants,
  UnitSchemaName,
} from '../models/unit.schema';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { DEFAULT_UNITS_SEED } from '../common/seeds/units.data';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { SyncService } from '../sync/sync.service';
import type { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class UnitService extends GenericDatabase<Model<UnitDocument>> {
  constructor(
    @InjectModel(UnitSchemaName)
    private readonly unitModel: Model<UnitDocument>,
    private readonly logService: LogService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly syncService: SyncService,
  ) {
    super(unitModel);
  }

  /**
   * Auto-seed 9 default measurement units for a company upon store registration.
   */
  async seedDefaultUnitsForCompany(
    companyId: string,
    userId?: string,
    session?: ClientSession,
  ): Promise<void> {
    try {
      const compObjId = new Types.ObjectId(companyId);
      const creatorObjId = userId ? new Types.ObjectId(userId) : null;

      for (const unitSeed of DEFAULT_UNITS_SEED) {
        const exists = await this.unitModel
          .findOne({
            companyId: compObjId,
            name: { $regex: `^${unitSeed.name.trim()}$`, $options: 'i' },
            isDeleted: false,
          })
          .session(session || null);

        if (!exists) {
          await this.unitModel.create(
            [
              {
                ...unitSeed,
                companyId: compObjId,
                ...(creatorObjId && { createdBy: creatorObjId }),
                isActive: true,
                isSystemGenerated: true,
              },
            ],
            { session: session || undefined },
          );
        }
      }
    } catch (error: unknown) {
      console.warn('[SEED] Failed to seed default units for store:', error);
    }
  }

  async createUnit(
    dto: CreateUnitDto,
    companyId: string,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const existing = await this.genericFindOne({
        companyId: new Types.ObjectId(companyId),
        name: { $regex: `^${dto.name.trim()}$`, $options: 'i' },
      });

      if (existing) {
        throw new BadRequestException(
          `Unit '${dto.name.trim()}' already exists in your store`,
        );
      }

      const created = await this.genericCreateOne({
        ...dto,
        name: dto.name.trim(),
        symbol: dto.symbol?.trim(),
        companyId: new Types.ObjectId(companyId),
        isActive: dto.isActive ?? true,
        isSystemGenerated: false,
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_UNIT,
        entityType: LogEntityType.UNIT,
        entityId: new Types.ObjectId(created._id),
        description: `Unit ${created.name} (${created.symbol || ''}) created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: 'Unit created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_UNIT,
        entityType: LogEntityType.UNIT,
        entityId: new Types.ObjectId(),
        description: 'Failed to create unit',
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
      throw new BadRequestException('Error creating unit');
    }
  }

  async findAllUnits(
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
          { name: { $regex: search, $options: 'i' } },
          { symbol: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.unitModel.find(filter).skip(skip).limit(limit).exec(),
        this.unitModel.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(totalCount / limit) || 1;

      return {
        success: true,
        message: 'Units fetched successfully',
        data: {
          units: data,
          pagination: {
            currentPage: page,
            limit,
            totalCount,
            totalPages,
          },
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching units');
    }
  }

  async findOneUnitById(id: string, userId: string, companyId: string) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const unit = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      return {
        success: true,
        message: 'Unit fetched successfully',
        data: unit,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching unit');
    }
  }

  async updateUnit(
    id: string,
    dto: UpdateUnitDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const unit = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.symbol !== undefined && { symbol: dto.symbol?.trim() }),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_UNIT,
        entityType: LogEntityType.UNIT,
        entityId: new Types.ObjectId(id),
        description: `Unit ${updated?.name} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: 'Unit updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_UNIT,
        entityType: LogEntityType.UNIT,
        entityId: new Types.ObjectId(id),
        description: 'Failed to update unit',
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
      throw new BadRequestException('Error updating unit');
    }
  }

  async deleteUnit(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const unit = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      if (unit.isSystemGenerated) {
        throw new BadRequestException('System default units cannot be deleted');
      }

      await this.genericDeleteOne(id);

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_UNIT,
        entityType: LogEntityType.UNIT,
        entityId: new Types.ObjectId(id),
        description: `Unit ${unit.name} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: 'Unit deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_UNIT,
        entityType: LogEntityType.UNIT,
        entityId: new Types.ObjectId(id),
        description: 'Failed to delete unit',
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
      throw new BadRequestException('Error deleting unit');
    }
  }
}
