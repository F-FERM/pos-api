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
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService extends GenericDatabase<Model<UserDocument>> {
  constructor(
    @InjectModel(UserSchemaName)
    private readonly userModel: Model<UserDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    @InjectModel(PrivilegesSchemaName)
    private readonly privilegeModel: Model<PrivilegesDocument>,
  ) {
    super(userModel);
  }

  /**
   * Validate user credentials.
   * @param username - The username of the user.
   * @param pass - The password of the user.
   * @returns The user document if valid, otherwise null.
   */
  async validateUser(username: string, pass: string): Promise<User | null> {
    try {
      const user = await this.genericFindByUsername(username, [
        `${UserModelConstants.privilegeId}`,
      ]);
      if (
        user &&
        (await bcrypt.compare(pass, user[UserModelConstants.password]))
      ) {
        return user;
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
      [UserModelConstants.isActive]: true,
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
      if (
        !privilege ||
        privilege[PrivilegesModelConstants.companyId]?.toString() !==
          dto.companyId
      ) {
        throw new NotFoundException('Privilege not found in this company');
      }

      const dup: UserDocument | null = await this.genericFindOne({
        $or: [
          { [UserModelConstants.username]: dto.username.toLowerCase() },
          { [UserModelConstants.email]: dto.email.toLowerCase() },
        ],
      });
      if (dup) {
        throw new BadRequestException('Username or email already exists');
      }

      const hashed: string = await bcrypt.hash(dto.password, 10);

      const created: UserDocument = await this.genericCreateOne({
        [UserModelConstants.username]: dto.username.toLowerCase(),
        [UserModelConstants.name]: dto.name,
        [UserModelConstants.email]: dto.email.toLowerCase(),
        [UserModelConstants.password]: hashed,
        [UserModelConstants.privilegeId]: new Types.ObjectId(dto.privilegeId),
        [UserModelConstants.companyId]: new Types.ObjectId(dto.companyId),
        [UserModelConstants.isActive]: true,
        [UserModelConstants.createdBy]: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(created._id),
        description: `User ${created[UserModelConstants.username]} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      const safe = created.toObject();
      delete (safe as Record<string, unknown>)[UserModelConstants.password];

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
        [UserModelConstants.isDeleted]: false,
      };

      if (!isSuperAdmin) {
        await this.companyService.validateCompany(companyId, userId);
        filter[UserModelConstants.companyId] = new Types.ObjectId(companyId);
      }

      if (search) {
        filter[UserModelConstants.username] = {
          $regex: search,
          $options: 'i',
        };
      }

      const skip: number = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.userModel
          .find(filter)
          .select(`-${UserModelConstants.password}`)
          .populate(UserModelConstants.privilegeId)
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
        [UserModelConstants.isDeleted]: false,
      };

      if (!isSuperAdmin) {
        await this.companyService.validateCompany(companyId, userId);
        filter[UserModelConstants.companyId] = new Types.ObjectId(companyId);
      }

      const user = await this.userModel
        .findOne(filter)
        .select(`-${UserModelConstants.password}`)
        .populate(UserModelConstants.privilegeId);
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
        [UserModelConstants.companyId]: new Types.ObjectId(companyId),
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const update: Record<string, unknown> = {};
      if (dto.username) {
        update[UserModelConstants.username] = dto.username.toLowerCase();
      }
      if (dto.name) {
        update[UserModelConstants.name] = dto.name;
      }
      if (dto.email) {
        update[UserModelConstants.email] = dto.email.toLowerCase();
      }
      if (dto.password) {
        update[UserModelConstants.password] = await bcrypt.hash(
          dto.password,
          10,
        );
      }
      if (dto.privilegeId) {
        const priv = await this.privilegeModel.findById(dto.privilegeId);
        if (
          !priv ||
          priv[PrivilegesModelConstants.companyId]?.toString() !== companyId
        ) {
          throw new NotFoundException('Privilege not found in this company');
        }
        update[UserModelConstants.privilegeId] = new Types.ObjectId(
          dto.privilegeId,
        );
      }
      if (typeof dto.isActive === 'boolean') {
        update[UserModelConstants.isActive] = dto.isActive;
      }

      const updated: UserDocument | null = await this.genericUpdateOne(
        id,
        update,
      );

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(id),
        description: `User ${updated?.[UserModelConstants.username]} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      const safe = updated?.toObject();
      if (safe) {
        delete (safe as Record<string, unknown>)[UserModelConstants.password];
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
        [UserModelConstants.companyId]: new Types.ObjectId(companyId),
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (id === userId) {
        throw new BadRequestException('You cannot delete your own account');
      }

      await this.genericUpdateOne(id, {
        [UserModelConstants.isActive]: false,
        [UserModelConstants.isDeleted]: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_USER,
        entityType: LogEntityType.USER,
        entityId: new Types.ObjectId(id),
        description: `User ${user[UserModelConstants.username]} deleted`,
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
