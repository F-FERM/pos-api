import {
  BadRequestException,
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, PipelineStage, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  PrivilegesDocument,
  PrivilegesModelConstants,
  PrivilegesSchemaName,
} from '../models/privilege.schema';
import { SYSTEM_PRIVILEGES } from '../common/seeds/privileges.data';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { CreatePrivilegesDto, UpdatePrivilegesDto } from './dto/privilege.dto';
import { Role } from '../utils/role.enum';
import { CompanyModelConstants } from '../models/company.schema';
import {
  SubModuleDocument,
  SubModuleSchemaName,
} from '../models/sub-module.schema';
import { UserDocument, UserSchemaName } from '../models/user.schema';
import { LogService } from '../log/log.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';

@Injectable()
export class PrivilegeService
  extends GenericDatabase<Model<PrivilegesDocument>>
  implements OnModuleInit
{
  constructor(
    @InjectModel(PrivilegesSchemaName)
    private readonly privilegeModel: Model<PrivilegesDocument>,
    @InjectModel(SubModuleSchemaName)
    private readonly subModuleModel: Model<SubModuleDocument>,
    @InjectModel(UserSchemaName)
    private readonly userModel: Model<UserDocument>,

    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    private readonly logService: LogService,
  ) {
    super(privilegeModel);
  }

  /**
   * NestJS lifecycle hook — seeds system privileges and backfills
   * user notification preferences.
   */
  async onModuleInit() {
    await this.generateSystemPrivileges();
  }

  /**
   * Seeds platform-level system privileges if they do not already exist.
   */
  async generateSystemPrivileges() {
    try {
      for (const privilege of SYSTEM_PRIVILEGES) {
        const exists: PrivilegesDocument | null = await this.genericFindOne({
          name: privilege.name,
        });

        if (!exists) {
          await this.genericCreateOne({
            name: privilege.name,
            description: privilege.description,
            roles: privilege.roles,
            isSystemGenerated: privilege.isSystemGenerated,
          });

          console.log('System privileges generated successfully');
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Failed to generate system privileges', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Failed to generate system privileges', error);
      throw new BadRequestException('Failed to generate system privileges');
    }
  }

  /**
   * Creates a new privilege for a company.
   *
   * Validation rules:
   * - Modules must be provided and non-empty.
   * - Permissions must be provided and non-empty.
   * - Duplicate privilege names within the company are rejected.
   * - Every submodule must belong to one of the selected modules.
   */
  async createPrivilege(
    dto: CreatePrivilegesDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      if (!dto.modules || !Array.isArray(dto.modules) || !dto.modules.length) {
        throw new BadRequestException('Modules are required');
      }

      if (
        !dto.permissions ||
        !Array.isArray(dto.permissions) ||
        !dto.permissions.length
      ) {
        throw new BadRequestException('Permissions are required');
      }

      const existing = await this.genericFindOne({
        name: dto.name,
        companyId,
      });

      if (existing) {
        throw new BadRequestException('Privilege already exists');
      }

      const subModuleIds = dto.permissions.map((p) => p.subModuleId);

      const uniqueSubModules = new Set(subModuleIds);
      if (uniqueSubModules.size !== subModuleIds.length) {
        throw new BadRequestException('Duplicate submodules not allowed');
      }

      const subModules = await this.subModuleModel.find({
        _id: { $in: subModuleIds },
      });

      if (subModules.length !== subModuleIds.length) {
        throw new BadRequestException('Some submodules not found');
      }

      const selectedModuleIds = dto.modules.map((m) => m.toString());

      for (const sm of subModules) {
        if (!selectedModuleIds.includes(sm.moduleId.toString())) {
          throw new BadRequestException(
            `Submodule ${sm.identity} not allowed for selected modules`,
          );
        }
      }

      const privilege: PrivilegesDocument = await this.genericCreateOne({
        ...dto,
        name: dto.name,
        description: dto.description,
        roles: [Role.user],
        modules: dto.modules,
        subModulePermissions: dto.permissions,
        companyId,
        createdBy: userId,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        action: LogActions.CREATE_PRIVILEGE,
        entityType: LogEntityType.PRIVILEGE,
        entityId: privilege._id as Types.ObjectId,
        description: 'Privilege created successfully',
        path: req.url,
        additionalData: {
          newData: privilege.toJSON(),
          oldData: null,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Privilege created successfully',
        data: privilege,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const { userId, companyId: userCompanyId } = req.user;
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);

      await this.logService.createLog({
        companyId: new Types.ObjectId(userCompanyId),
        action: LogActions.CREATE_PRIVILEGE,
        entityType: LogEntityType.PRIVILEGE,
        entityId: new Types.ObjectId(),
        description: 'Privilege creation failed',
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
          dto,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });

      if (error instanceof Error) {
        console.log('Error creating privilege', error.message);
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error creating privilege');
    }
  }

  /**
   * Paginated list of privileges scoped by role (superadmin sees all).
   */
  async findAllPrivileges(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    search?: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      const isSuperAdmin: boolean = roles?.includes(Role.superadmin);

      if (!isSuperAdmin) {
        await this.companyService.validateCompany(companyId, userId);
      }

      const skip = (page - 1) * limit;

      const matchStage: mongoose.QueryFilter<PrivilegesDocument> = {
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        matchStage.companyId = new mongoose.Types.ObjectId(companyId);
      }

      if (search) {
        matchStage.name = { $regex: search, $options: 'i' };
      }

      const pipeline: PipelineStage[] = [
        { $match: matchStage },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $facet: {
            data: [
              {
                $project: {
                  name: 1,
                  description: 1,
                  roles: 1,
                  isSystemGenerated: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [{ $count: 'count' }],
          },
        },
      ];

      type Result = {
        data: PrivilegesDocument[];
        totalCount: { count: number }[];
      };

      const result: Result[] = await this.privilegeModel.aggregate(pipeline);

      const data: PrivilegesDocument[] = result[0]?.data ?? [];
      const totalCount: number = result[0]?.totalCount[0]?.count ?? 0;

      return {
        success: true,
        message: 'Privileges fetched successfully',
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
        console.log('Error fetching privileges', error.message);
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching privileges');
    }
  }

  /**
   * Fetch one privilege by id, scoped to the company.
   */
  async findOnePrivilegeById(id: string, userId: string, companyId: string) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const privilege: PrivilegesDocument | null =
        await this.genericFindOneWithPopulate(
          {
            _id: id,
            companyId,
          },
          {
            path: PrivilegesModelConstants.companyId,
            select: CompanyModelConstants.name,
          },
        );

      if (!privilege) {
        throw new BadRequestException('Privilege not found');
      }

      return {
        success: true,
        message: 'Privilege fetched successfully',
        data: privilege,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error fetching privilege', error.message);
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching privilege');
    }
  }

  /**
   * Updates an existing privilege.
   *
   * Same validation rules as createPrivilege, but only applied when the
   * corresponding field is present in the payload.
   */
  async updatePrivilege(
    id: string,
    dto: UpdatePrivilegesDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const existingPrivilege = await this.genericFindOne({
        _id: id,
        companyId,
      });

      if (!existingPrivilege) {
        throw new BadRequestException('Privilege not found');
      }

      const updatePayload: Partial<PrivilegesDocument> = {
        name: dto.name,
        description: dto.description,
      };

      if (dto.modules || dto.permissions) {
        if (
          dto.modules &&
          (!Array.isArray(dto.modules) || !dto.modules.length)
        ) {
          throw new BadRequestException('Modules are required');
        }

        if (
          dto.permissions &&
          (!Array.isArray(dto.permissions) || !dto.permissions.length)
        ) {
          throw new BadRequestException('Permissions are required');
        }

        if (dto.modules) {
          const normalizedModules = dto.modules.map((m) =>
            new Types.ObjectId(m).toString(),
          );
          updatePayload.modules = normalizedModules.map(
            (m) => new Types.ObjectId(m),
          );
        }

        if (dto.permissions) {
          const subModuleIds = dto.permissions.map((p) =>
            new Types.ObjectId(p.subModuleId).toString(),
          );

          const uniqueSubModules = new Set(subModuleIds);
          if (uniqueSubModules.size !== subModuleIds.length) {
            throw new BadRequestException('Duplicate submodules not allowed');
          }

          const subModules = await this.subModuleModel.find({
            _id: { $in: subModuleIds },
          });

          if (subModules.length !== subModuleIds.length) {
            throw new BadRequestException('Some submodules not found');
          }

          const moduleIdsToCheck =
            dto.modules?.map((m) => m.toString()) ||
            existingPrivilege.modules.map((m) => m.toString());

          for (const sm of subModules) {
            if (!moduleIdsToCheck.includes(sm.moduleId.toString())) {
              throw new BadRequestException(
                `Submodule ${sm.identity} not allowed for selected modules`,
              );
            }
          }

          updatePayload.subModulePermissions = dto.permissions.map((p) => ({
            subModuleId: new Types.ObjectId(p.subModuleId),
            canCreate: p.canCreate,
            canRead: p.canRead,
            canUpdate: p.canUpdate,
            canDelete: p.canDelete,
          }));
        }
      }

      const updated: PrivilegesDocument | null = await this.genericUpdateOne(
        id,
        updatePayload,
      );

      if (!updated) {
        throw new BadRequestException('Privilege not found');
      }

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        action: LogActions.UPDATE_PRIVILEGE,
        entityType: LogEntityType.PRIVILEGE,
        entityId: new Types.ObjectId(id),
        description: 'Privilege updated successfully',
        path: req.url,
        additionalData: {
          oldData: existingPrivilege.toJSON(),
          newData: updated.toJSON(),
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Privilege updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const { userId, companyId: userCompanyId } = req.user;
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);

      await this.logService.createLog({
        companyId: new Types.ObjectId(userCompanyId),
        action: LogActions.UPDATE_PRIVILEGE,
        entityType: LogEntityType.PRIVILEGE,
        entityId: new Types.ObjectId(id),
        description: 'Privilege update failed',
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
          dto,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });

      if (error instanceof Error) {
        console.log('Error updating privilege', error.message);
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating privilege');
    }
  }

  /**
   * Soft-deletes a privilege.
   * Rejects if the privilege is system-generated or still assigned to users.
   */
  async deletePrivilege(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const privilege: PrivilegesDocument | null = await this.genericFindOne({
        _id: id,
        companyId,
      });

      if (!privilege) {
        throw new BadRequestException('Privilege not found');
      }

      if (privilege.isSystemGenerated) {
        throw new BadRequestException(
          'System generated privileges cannot be deleted',
        );
      }

      const assignedUsersCount: number = await this.userModel.countDocuments({
        isDeleted: false,
        privilegeId: privilege._id,
      });

      if (assignedUsersCount > 0) {
        throw new BadRequestException(
          `Cannot delete privilege. It is assigned to ${assignedUsersCount} user(s).`,
        );
      }

      await this.genericDeleteOne(id);

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        action: LogActions.DELETE_PRIVILEGE,
        entityType: LogEntityType.PRIVILEGE,
        entityId: new Types.ObjectId(id),
        description: 'Privilege deleted successfully',
        path: req.url,
        additionalData: {
          deletedData: privilege.toJSON(),
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Privilege deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const { userId, companyId: userCompanyId } = req.user;
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);

      await this.logService.createLog({
        companyId: new Types.ObjectId(userCompanyId),
        action: LogActions.DELETE_PRIVILEGE,
        entityType: LogEntityType.PRIVILEGE,
        entityId: new Types.ObjectId(id),
        description: 'Privilege deletion failed',
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });

      if (error instanceof Error) {
        console.log('Error deleting privilege', error.message);
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error deleting privilege');
    }
  }
}
