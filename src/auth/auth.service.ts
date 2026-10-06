import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { LogService } from '../log/log.service';
import { AuthedRequest, IPermission } from '../utils/common.types';
import { UserDocument, UserModelConstants } from '../models/user.schema';
import { ModuleDocument, ModuleSchemaName } from '../models/module.schema';
import {
  SubModuleDocument,
  SubModuleSchemaName,
} from '../models/sub-module.schema';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    @InjectModel(ModuleSchemaName)
    private readonly moduleModel: Model<ModuleDocument>,
    @InjectModel(SubModuleSchemaName)
    private readonly subModuleModel: Model<SubModuleDocument>,
    private readonly logService: LogService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string) {
    const user = await this.userService.validateUser(username, pass);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(user: any, req?: AuthedRequest) {
    try {
      const _user = (await this.userService.genericFindOneWithPopulate(
        { _id: user._id },
        [
          {
            path: UserModelConstants.privilegeId,
            select: 'roles modules subModulePermissions',
          },
        ],
      )) as UserDocument;

      const ipAddress = req
        ? await this.userService.getClientIpAddress(req)
        : 'SYSTEM';

      if (!_user?.privilegeId) {
        throw new BadRequestException('Privilege not found');
      }

      const privilege: any = _user.privilegeId;

      const roles = Array.isArray(privilege.roles)
        ? privilege.roles
        : [privilege.roles];

      const payload: any = {
        username: _user.username,
        userId: _user._id,
        companyId: _user.companyId ? _user.companyId.toString() : '',
        email: _user.email || '',
        roles,
      };

      if (roles.includes(Role.superadmin)) {
        await this.logService.createLog({
          companyId: _user?.companyId ?? null,
          action: LogActions.USER_LOGIN,
          entityType: LogEntityType.AUTH,
          entityId: new Types.ObjectId(_user._id),
          description: 'Superadmin login successful',
          path: req ? req.url : '/auth/login',
          additionalData: {
            email: _user.email,
            roles,
          },
          createdBy: new Types.ObjectId(_user._id),
          ipAddress,
          status: LogStatus.SUCCESS,
        });

        return {
          access_token: this.jwtService.sign(payload),
          expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        };
      }

      const privilegeModuleIds = (privilege.modules || [])
        .map((m: any) => m?.toString())
        .filter(Boolean);

      let modules: any[] = [];

      if (privilegeModuleIds.length > 0) {
        modules = await this.moduleModel.find({
          _id: { $in: privilegeModuleIds },
          isDeleted: false,
        });
      }

      payload.modules = modules.map((m: any) => m.identity);

      const subModulePermissions = Array.isArray(privilege.subModulePermissions)
        ? privilege.subModulePermissions
        : [];

      const subModuleIds = subModulePermissions
        .map((p: any) => p?.subModuleId?.toString())
        .filter(Boolean);

      let subModules: any[] = [];

      if (subModuleIds.length > 0) {
        subModules = await this.subModuleModel.find({
          _id: { $in: subModuleIds },
          isDeleted: false,
        });
      }

      const subModuleMap: Record<string, string> = {};

      subModules.forEach((sm: any) => {
        subModuleMap[sm._id.toString()] = sm.identity;
      });

      const permissions: IPermission[] = subModulePermissions.map((p: any) => ({
        subModule: subModuleMap[p.subModuleId?.toString()] || '',
        subModuleId: p.subModuleId?.toString(),
        canCreate: !!p.canCreate,
        canRead: !!p.canRead,
        canUpdate: !!p.canUpdate,
        canDelete: !!p.canDelete,
      }));

      payload.permissions = permissions;

      await this.userService.genericUpdateOne(_user._id.toString(), {
        $set: {
          lastLoginAt: new Date(),
        },
      });

      await this.logService.createLog({
        companyId: _user?.companyId ?? null,
        action: LogActions.USER_LOGIN,
        entityType: LogEntityType.AUTH,
        entityId: new Types.ObjectId(_user._id),
        description: 'User login successful',
        path: req ? req.url : '/auth/login',
        additionalData: {
          email: _user.email,
          roles,
        },
        createdBy: new Types.ObjectId(_user._id),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        access_token: this.jwtService.sign(payload),
        expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.userService.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: user?.companyId ?? null,
        action: LogActions.USER_LOGIN,
        entityType: LogEntityType.AUTH,
        entityId: user?._id
          ? new Types.ObjectId(user._id)
          : new Types.ObjectId(),
        description: 'Login failed',
        path: req ? req.url : '/auth/login',
        additionalData: {
          error: error instanceof Error ? error.message : error,
          attemptedUserId: user?._id,
        },
        createdBy: user?._id
          ? new Types.ObjectId(user._id)
          : new Types.ObjectId(),
        ipAddress,
        status: LogStatus.FAILED,
      });

      if (error instanceof Error) {
        console.log('Error while login user', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while login user', error);
      throw new BadRequestException('Error while login user');
    }
  }
}
