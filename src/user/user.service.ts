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
import * as bcrypt from 'bcrypt';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  User,
  UserDocument,
  UserModelConstants,
  UserSchemaName,
} from '../models/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';
import {
  PrivilegesDocument,
  PrivilegesModelConstants,
  PrivilegesSchemaName,
} from '../models/privilege.schema';
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import {
  StoreLicenseDocument,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { seedSuperAdminUser } from '../common/seeds/superadmin.seed';

import { SyncService } from '../sync/sync.service';

@Injectable()
export class UserService extends GenericDatabase<Model<UserDocument>> {
  constructor(
    @InjectModel(UserSchemaName)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(StoreLicenseSchemaName)
    private readonly storeLicenseModel: Model<StoreLicenseDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    @InjectModel(PrivilegesSchemaName)
    private readonly privilegeModel: Model<PrivilegesDocument>,

    // Cloud DB Models ('cloudConnection')
    @InjectModel(UserSchemaName, 'cloudConnection')
    private readonly userModelCloud: Model<UserDocument>,
    @InjectModel(PrivilegesSchemaName, 'cloudConnection')
    private readonly privilegeModelCloud: Model<PrivilegesDocument>,

    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
  ) {
    super(userModel);
  }

  async onModuleInit() {
    if (this.userModelCloud && this.privilegeModelCloud) {
      await seedSuperAdminUser(
        this.userModelCloud,
        this.privilegeModelCloud,
      ).catch(() => null);
    }
  }

  getUserModelCloud(): Model<UserDocument> | null {
    return this.userModelCloud || null;
  }

  /**
   * Validate user credentials.
   * Checks local user DB first; falls back to Cloud DB for Global Superadmin login.
   */
  async validateUser(username: string, pass: string): Promise<User | null> {
    try {
      const cleanUsername = username.trim().toLowerCase();

      // 1. Validate local store user in Local DB
      const localUser = await this.userModel
        .findOne({
          $or: [{ username: cleanUsername }, { email: cleanUsername }],
          isDeleted: false,
        })
        .populate(`${UserModelConstants.privilegeId!}`)
        .exec();

      if (localUser && (await bcrypt.compare(pass, localUser.password))) {
        return localUser;
      }

      // 2. Validate Superadmin credentials against Cloud DB
      if (this.userModelCloud) {
        const cloudUser = await this.userModelCloud
          .findOne({
            $or: [{ username: cleanUsername }, { email: cleanUsername }],
            isDeleted: false,
          })
          .populate(`${UserModelConstants.privilegeId!}`)
          .exec();

        if (cloudUser && (await bcrypt.compare(pass, cloudUser.password))) {
          // Return Cloud Superadmin user directly without polluting Local DB
          return cloudUser;
        }
      }

      return null;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error validating user:', error);
        throw new NotFoundException(error.message);
      }
      console.error('Unknown error validating user:', error);
      throw error;
    }
  }

  async validateAuthenticatedUser(id: string): Promise<UserDocument> {
    if (!this.isValidMongoId(id)) {
      throw new NotFoundException('Invalid user id');
    }
    const user: UserDocument | null = await this.genericFindOneOrNotFound({
      _id: id,
      isActive: true,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async createUser(dto: CreateUserDto, userId: string, req: AuthedRequest) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const privilege = await this.privilegeModel.findById(dto.privilegeId);
      if (!privilege || privilege.companyId?.toString() !== dto.companyId) {
        throw new NotFoundException('Privilege not found in this company');
      }

      // Enforce strictly 1 Company Admin (Role.admin) limit per store
      const isCreatingAdminRole = Array.isArray(privilege.roles)
        ? privilege.roles.includes(Role.admin)
        : privilege.roles === Role.admin;

      if (isCreatingAdminRole) {
        const adminPrivileges = await this.privilegeModel.find({
          companyId: new Types.ObjectId(dto.companyId),
          roles: Role.admin,
          isDeleted: false,
        });

        const adminPrivilegeIds = adminPrivileges.map((p) => p._id);

        const existingAdminUser = await this.userModel.findOne({
          companyId: new Types.ObjectId(dto.companyId),
          privilegeId: { $in: adminPrivilegeIds },
          isDeleted: false,
        });

        if (existingAdminUser) {
          throw new BadRequestException(
            'A company can only have strictly ONE Company Admin (the store owner). Additional accounts must be staff / cashier users.',
          );
        }
      }

      // Validate company max user capacity limits
      const currentActiveUsers = await this.userModel.countDocuments({
        companyId: new Types.ObjectId(dto.companyId),
        isDeleted: false,
      });

      const storeLicense = await this.storeLicenseModel.findOne({
        companyId: new Types.ObjectId(dto.companyId),
        isDeleted: false,
      });

      const maxAllowedUsers = storeLicense?.maxUsers || 5;

      if (currentActiveUsers >= maxAllowedUsers) {
        throw new BadRequestException(
          `User creation limit reached for your store license (${currentActiveUsers}/${maxAllowedUsers} active users). Please upgrade your subscription to add more staff accounts.`,
        );
      }

      const dup: UserDocument | null = await this.genericFindOne({
        $or: [
          { username: dto.username.toLowerCase() },
          { email: dto.email.toLowerCase() },
        ],
      });
      if (dup) {
        throw new BadRequestException('Username or email already exists');
      }

      const hashed: string = await bcrypt.hash(dto.password, 10);

      const created: UserDocument = await this.genericCreateOne({
        username: dto.username.toLowerCase(),
        name: dto.name,
        email: dto.email.toLowerCase(),
        password: hashed,
        privilegeId: new Types.ObjectId(dto.privilegeId),
        companyId: new Types.ObjectId(dto.companyId),
        isActive: true,
        createdBy: new Types.ObjectId(userId),
      });

      await this.companyModel.updateOne(
        { _id: new Types.ObjectId(dto.companyId) },
        { $inc: { currentUserCount: 1 } },
      );

      // Instantly trigger background sync to Cloud MongoDB
      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(created._id),
        description: `User ${created.username} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      const safe = created.toObject();
      delete (safe as Record<string, unknown>).password;

      return {
        success: true,
        message: 'User created successfully',
        data: safe,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(),
        description: `Failed to create user`,
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
      throw new BadRequestException('Error creating user');
    }
  }

  async findAllUsers(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    search?: string,
  ) {
    try {
      await this.validateAuthenticatedUser(userId);
      const isSuperAdmin: boolean = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = {
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        await this.companyService.validateCompany(companyId, userId);
        filter.companyId = new Types.ObjectId(companyId);
      }

      if (search) {
        filter.username = {
          $regex: search,
          $options: 'i',
        };
      }

      const skip: number = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.userModel
          .find(filter)
          .select(`-${UserModelConstants.password}`)
          .populate([
            {
              path: UserModelConstants.privilegeId!,
              select: `${PrivilegesModelConstants.name} ${PrivilegesModelConstants.roles} ${PrivilegesModelConstants.description}`,
            },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.userModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Users fetched successfully',
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
      throw new BadRequestException('Error fetching users');
    }
  }

  async findOneUser(
    id: string,
    userId: string,
    companyId: string,
    roles: string[],
  ) {
    try {
      await this.validateAuthenticatedUser(userId);
      const isSuperAdmin: boolean = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = {
        _id: id,
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        await this.companyService.validateCompany(companyId, userId);
        filter.companyId = new Types.ObjectId(companyId);
      }

      const user = await this.userModel
        .findOne(filter)
        .select(`-${UserModelConstants.password}`)
        .populate([
          {
            path: UserModelConstants.privilegeId!,
            select: `${PrivilegesModelConstants.name} ${PrivilegesModelConstants.roles} ${PrivilegesModelConstants.description}`,
          },
        ]);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        success: true,
        message: 'User fetched successfully',
        data: user,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching user');
    }
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const user: UserDocument | null = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const update: Record<string, unknown> = {};
      if (dto.username) {
        update.username = dto.username.toLowerCase();
      }
      if (dto.name) {
        update.name = dto.name;
      }
      if (dto.email) {
        update.email = dto.email.toLowerCase();
      }
      if (dto.password) {
        update.password = await bcrypt.hash(dto.password, 10);
      }
      if (dto.privilegeId) {
        const priv = await this.privilegeModel.findById(dto.privilegeId);
        if (!priv || priv.companyId?.toString() !== companyId) {
          throw new NotFoundException('Privilege not found in this company');
        }
        update.privilegeId = new Types.ObjectId(dto.privilegeId);
      }
      if (typeof dto.isActive === 'boolean') {
        update.isActive = dto.isActive;
      }

      const updated: UserDocument | null = await this.genericUpdateOne(
        id,
        update,
      );

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(id),
        description: `User ${updated?.username} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      const safe = updated?.toObject();
      if (safe) {
        delete (safe as Record<string, unknown>).password;
      }

      return {
        success: true,
        message: 'User updated successfully',
        data: safe,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(id),
        description: `Failed to update user`,
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
      throw new BadRequestException('Error updating user');
    }
  }

  async deleteUser(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const user: UserDocument | null = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (id === userId) {
        throw new BadRequestException('You cannot delete your own account');
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      await this.companyModel.updateOne(
        { _id: new Types.ObjectId(companyId) },
        { $inc: { currentUserCount: -1 } },
      );

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(id),
        description: `User ${user.username} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'User deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(id),
        description: `Failed to delete user`,
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
      throw new BadRequestException('Error deleting user');
    }
  }
}
