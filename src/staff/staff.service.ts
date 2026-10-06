import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  Staff,
  StaffDocument,
  StaffModelConstants,
  StaffSchemaName,
} from '../models/staff.schema';
import {
  User,
  UserDocument,
  UserModelConstants,
  UserSchemaName,
} from '../models/user.schema';
import {
  PrivilegesDocument,
  PrivilegesModelConstants,
  PrivilegesSchemaName,
} from '../models/privilege.schema';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class StaffService extends GenericDatabase<Model<StaffDocument>> {
  constructor(
    @InjectModel(StaffSchemaName)
    private readonly staffModel: Model<StaffDocument>,
    @InjectModel(UserSchemaName)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(PrivilegesSchemaName)
    private readonly privilegeModel: Model<PrivilegesDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {
    super(staffModel);
  }

  async createStaff(dto: CreateStaffDto, userId: string, req: AuthedRequest) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const existingStaff = await this.genericFindOne({
        companyId: new Types.ObjectId(dto.companyId),
        $or: [
          { phone: dto.phone.trim() },
          { pin: dto.pin.trim() },
          ...(dto.email ? [{ email: dto.email.trim().toLowerCase() }] : []),
        ],
      });

      if (existingStaff) {
        throw new BadRequestException(
          'Staff with this phone number, PIN, or email already exists in your company',
        );
      }

      const privilege = await this.privilegeModel.findOne({
        _id: new Types.ObjectId(dto.privilegeId),
        isDeleted: false,
      });

      if (!privilege) {
        throw new BadRequestException('Invalid privilege ID specified');
      }

      const hashedPassword = await bcrypt.hash(dto.pin.trim(), 10);
      const username = dto.phone.trim();

      const existingUser = await this.userModel.findOne({
        $or: [
          { username },
          ...(dto.email ? [{ email: dto.email.trim().toLowerCase() }] : []),
        ],
      });

      if (existingUser) {
        throw new BadRequestException(
          'A user account with this phone/username or email already exists',
        );
      }

      const [createdUser] = await this.userModel.create([
        {
          username,
          name: dto.name.trim(),
          ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
          password: hashedPassword,
          privilegeId: new Types.ObjectId(dto.privilegeId),
          companyId: new Types.ObjectId(dto.companyId),
          isActive: dto.isActive ?? true,
          createdBy: new Types.ObjectId(userId),
        },
      ]);

      const createdStaff = await this.genericCreateOne({
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
        designation: dto.designation.trim(),
        pin: dto.pin.trim(),
        userId: createdUser._id,
        privilegeId: new Types.ObjectId(dto.privilegeId),
        companyId: new Types.ObjectId(dto.companyId),
        isActive: dto.isActive ?? true,
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_STAFF,
        entityType: LogEntityType.STAFF,
        entityId: new Types.ObjectId(createdStaff._id),
        description: `Staff ${createdStaff.name} (${createdStaff.designation}) created and auto-converted to user account`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Staff created and converted to user account successfully',
        data: {
          staff: createdStaff,
          user: {
            id: createdUser._id,
            username: createdUser.username,
            name: createdUser.name,
            email: createdUser.email,
          },
        },
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_STAFF,
        entityType: LogEntityType.STAFF,
        entityId: new Types.ObjectId(),
        description: 'Failed to create staff',
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
      throw new BadRequestException('Error creating staff');
    }
  }

  async findAllStaff(
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
          { phone: { $regex: search, $options: 'i' } },
          { designation: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.staffModel
          .find(filter)
          .populate([
            {
              path: StaffModelConstants.userId,
              select: `${UserModelConstants.username} ${UserModelConstants.name} ${UserModelConstants.email}`,
            },
            {
              path: StaffModelConstants.privilegeId,
              select: `${PrivilegesModelConstants.name} ${PrivilegesModelConstants.roles}`,
            },
            {
              path: StaffModelConstants.createdBy,
              select: `${UserModelConstants.username} ${UserModelConstants.name}`,
            },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.staffModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Staff records fetched successfully',
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
      throw new BadRequestException('Error fetching staff records');
    }
  }

  async findOneStaff(
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

      const staff = await this.staffModel
        .findOne(filter)
        .populate([
          {
            path: StaffModelConstants.userId,
            select: `${UserModelConstants.username} ${UserModelConstants.name} ${UserModelConstants.email}`,
          },
          {
            path: StaffModelConstants.privilegeId,
            select: `${PrivilegesModelConstants.name} ${PrivilegesModelConstants.roles} ${PrivilegesModelConstants.subModulePermissions}`,
          },
          {
            path: StaffModelConstants.createdBy,
            select: `${UserModelConstants.username} ${UserModelConstants.name}`,
          },
        ]);

      if (!staff) {
        throw new NotFoundException('Staff record not found');
      }

      return {
        success: true,
        message: 'Staff record fetched successfully',
        data: staff,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching staff record');
    }
  }

  async updateStaff(
    id: string,
    dto: UpdateStaffDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const staff = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!staff) {
        throw new NotFoundException('Staff record not found');
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.phone && { phone: dto.phone.trim() }),
        ...(dto.email !== undefined && {
          email: dto.email?.trim().toLowerCase() || null,
        }),
        ...(dto.designation && { designation: dto.designation.trim() }),
        ...(dto.pin && { pin: dto.pin.trim() }),
        ...(dto.privilegeId && {
          privilegeId: new Types.ObjectId(dto.privilegeId),
        }),
      });

      if (staff.userId) {
        const userUpdate: Record<string, any> = {};
        if (dto.name) userUpdate.name = dto.name.trim();
        if (dto.email !== undefined)
          userUpdate.email = dto.email?.trim().toLowerCase() || null;
        if (dto.pin)
          userUpdate.password = await bcrypt.hash(dto.pin.trim(), 10);
        if (dto.privilegeId)
          userUpdate.privilegeId = new Types.ObjectId(dto.privilegeId);
        if (dto.isActive !== undefined) userUpdate.isActive = dto.isActive;

        if (Object.keys(userUpdate).length > 0) {
          await this.userModel.updateOne(
            { _id: staff.userId },
            { $set: userUpdate },
          );
        }
      }

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_STAFF,
        entityType: LogEntityType.STAFF,
        entityId: new Types.ObjectId(id),
        description: `Staff ${updated?.name} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Staff record updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_STAFF,
        entityType: LogEntityType.STAFF,
        entityId: new Types.ObjectId(id),
        description: 'Failed to update staff',
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
      throw new BadRequestException('Error updating staff record');
    }
  }

  async deleteStaff(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const staff = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!staff) {
        throw new NotFoundException('Staff record not found');
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      if (staff.userId) {
        await this.userModel.updateOne(
          { _id: staff.userId },
          { $set: { isActive: false, isDeleted: true } },
        );
      }

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_STAFF,
        entityType: LogEntityType.STAFF,
        entityId: new Types.ObjectId(id),
        description: `Staff ${staff.name} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Staff record and user account deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_STAFF,
        entityType: LogEntityType.STAFF,
        entityId: new Types.ObjectId(id),
        description: 'Failed to delete staff',
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
      throw new BadRequestException('Error deleting staff record');
    }
  }
}
