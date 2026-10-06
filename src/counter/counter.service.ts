import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  Counter,
  CounterDocument,
  CounterSchemaName,
} from '../models/counter.schema';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class CounterService extends GenericDatabase<Model<CounterDocument>> {
  constructor(
    @InjectModel(CounterSchemaName)
    private readonly counterModel: Model<CounterDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {
    super(counterModel);
  }

  async createDefaultCounterForCompany(
    companyId: string,
    userId: string,
    session?: mongoose.ClientSession,
  ): Promise<CounterDocument> {
    const existing = await this.counterModel.findOne({
      companyId: new Types.ObjectId(companyId),
      isDefault: true,
      isDeleted: false,
    });

    if (existing) return existing;

    const counterData = {
      name: 'Main Counter',
      code: 'CNT-01',
      isDefault: true,
      isActive: true,
      companyId: new Types.ObjectId(companyId),
      createdBy: new Types.ObjectId(userId),
      isDeleted: false,
    };

    if (session) {
      const [created] = await this.counterModel.create([counterData], {
        session,
      });
      return created;
    }

    return await this.counterModel.create(counterData);
  }

  async createCounter(
    dto: CreateCounterDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const existing = await this.genericFindOne({
        companyId: new Types.ObjectId(dto.companyId),
        $or: [
          { name: { $regex: `^${dto.name.trim()}$`, $options: 'i' } },
          { code: dto.code.trim().toUpperCase() },
        ],
      });

      if (existing) {
        throw new BadRequestException('Counter name or code already exists');
      }

      if (dto.isDefault) {
        await this.counterModel.updateMany(
          { companyId: new Types.ObjectId(dto.companyId), isDeleted: false },
          { $set: { isDefault: false } },
        );
      }

      const created = await this.genericCreateOne({
        ...dto,
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_COUNTER,
        entityType: LogEntityType.COUNTER,
        entityId: new Types.ObjectId(created._id),
        description: `Counter ${created.name} (${created.code}) created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Counter created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_COUNTER,
        entityType: LogEntityType.COUNTER,
        entityId: new Types.ObjectId(),
        description: 'Failed to create counter',
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
      throw new BadRequestException('Failed to create counter');
    }
  }

  async findAllCounters(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    req: AuthedRequest,
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
          { code: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.counterModel
          .find(filter)
          .populate('createdBy', 'username name')
          .sort({ isDefault: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.counterModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Counters fetched successfully',
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
      throw new BadRequestException('Error fetching counters');
    }
  }

  async findOneCounter(
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

      const counter = await this.counterModel
        .findOne(filter)
        .populate('createdBy', 'username name');

      if (!counter) {
        throw new NotFoundException('Counter not found');
      }

      return {
        success: true,
        message: 'Counter fetched successfully',
        data: counter,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching counter');
    }
  }

  async updateCounter(
    id: string,
    dto: UpdateCounterDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const counter = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!counter) {
        throw new NotFoundException('Counter not found');
      }

      if (dto.isDefault) {
        await this.counterModel.updateMany(
          {
            companyId: new Types.ObjectId(companyId),
            _id: { $ne: new Types.ObjectId(id) },
            isDeleted: false,
          },
          { $set: { isDefault: false } },
        );
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.code && { code: dto.code.trim().toUpperCase() }),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_COUNTER,
        entityType: LogEntityType.COUNTER,
        entityId: new Types.ObjectId(id),
        description: `Counter ${updated?.name} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Counter updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_COUNTER,
        entityType: LogEntityType.COUNTER,
        entityId: new Types.ObjectId(id),
        description: 'Failed to update counter',
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
      throw new BadRequestException('Error updating counter');
    }
  }

  async deleteCounter(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const counter = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!counter) {
        throw new NotFoundException('Counter not found');
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_COUNTER,
        entityType: LogEntityType.COUNTER,
        entityId: new Types.ObjectId(id),
        description: `Counter ${counter.name} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Counter deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_COUNTER,
        entityType: LogEntityType.COUNTER,
        entityId: new Types.ObjectId(id),
        description: 'Failed to delete counter',
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
      throw new BadRequestException('Error deleting counter');
    }
  }
}
