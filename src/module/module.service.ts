import {
  BadRequestException,
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  ModuleDocument,
  ModuleModelConstants,
  ModuleSchemaName,
} from '../models/module.schema';
import { SYSTEM_MODULES } from '../common/seeds/modules.data';
import { AuthedRequest } from '../utils/common.types';
import { Role } from '../utils/role.enum';
import { CompanyService } from '../company/company.service';
import {
  SubModuleDocument,
  SubModuleModelConstants,
  SubModuleSchemaName,
} from '../models/sub-module.schema';
import { SYSTEM_SUBMODULES } from '../common/seeds/sub-modules.data';

@Injectable()
export class ModuleService
  extends GenericDatabase<Model<ModuleDocument>>
  implements OnModuleInit
{
  private subModuleDB: GenericDatabase<Model<SubModuleDocument>>;

  constructor(
    @InjectModel(ModuleSchemaName)
    private readonly moduleModel: Model<ModuleDocument>,
    @InjectModel(SubModuleSchemaName)
    private readonly subModuleModel: Model<SubModuleDocument>,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
  ) {
    super(moduleModel);
    this.subModuleDB = new GenericDatabase(this.subModuleModel);
  }

  /**
   * NestJS lifecycle hook — seeds system modules and submodules.
   */
  async onModuleInit() {
    await this.generateSystemModules();
    await this.generateSystemSubModules();
  }

  /**
   * Seeds system-defined modules if they don't already exist.
   * Idempotent by `identity`.
   */
  async generateSystemModules() {
    try {
      for (const module of SYSTEM_MODULES) {
        const exists: ModuleDocument | null = await this.genericFindOne({
          identity: module.identity,
        });

        if (!exists) {
          await this.genericCreateOne({
            identity: module.identity,
            label: module.label,
            isSystemGenerated: module.isSystemGenerated,
          });

          console.log('System modules generated successfully');
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Failed to generate system modules', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Failed to generate system modules', error);
      throw new BadRequestException('Failed to generate system modules');
    }
  }

  /**
   * Seeds system-defined submodules, grouped by their parent module.
   * Idempotent by `(identity, moduleId)`.
   */
  async generateSystemSubModules() {
    try {
      for (const module of SYSTEM_MODULES) {
        const dbModule: ModuleDocument | null = await this.genericFindOne({
          identity: module.identity,
        });

        if (!dbModule) continue;

        const subModuleGroup:
          | {
              moduleIdentity: string;
              subModules: {
                identity: string;
                label: string;
              }[];
            }
          | undefined = SYSTEM_SUBMODULES.find(
          (sm) => sm.moduleIdentity === module.identity,
        );

        if (!subModuleGroup) continue;

        for (const sub of subModuleGroup.subModules) {
          const exists: SubModuleDocument | null =
            await this.subModuleDB.genericFindOne({
              identity: sub.identity,
              moduleId: dbModule._id,
            });

          if (!exists) {
            await this.subModuleDB.genericCreateOne({
              identity: sub.identity,
              label: sub.label,
              moduleId: dbModule._id,
              isSystemGenerated: true,
            });

            console.log('System submodules generated successfully');
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Failed to generate submodules', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Failed to generate submodules', error);
      throw new BadRequestException('Failed to generate submodules');
    }
  }

  /**
   * Retrieves all modules.
   *
   * Every company has full module access in this architecture, so the
   * result is identical for superadmins and company users — every active
   * module in the platform catalog.
   */
  async findAllModules(user: AuthedRequest): Promise<{
    success: boolean;
    message: string;
    data: ModuleDocument[];
    statusCode: number;
  }> {
    try {
      await this.companyService.validateCompany(
        user.user.companyId,
        user.user.userId,
      );

      const modules: ModuleDocument[] = await this.genericFindAll({
        isActive: true,
      });

      return {
        success: true,
        message: user.user.roles?.includes(Role.superadmin)
          ? 'Modules fetched successfully'
          : 'Company modules fetched successfully',
        data: modules,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error while fetching modules', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while fetching modules', error);
      throw new BadRequestException('Error while fetching modules');
    }
  }

  /**
   * Retrieves a module by its ID.
   */
  async findOneModuleById(id: string): Promise<{
    success: boolean;
    message: string;
    data: ModuleDocument;
    statusCode: number;
  }> {
    try {
      const module: ModuleDocument | null = await this.genericFindOne({
        _id: id,
      });
      if (!module) {
        throw new BadRequestException('Module not found');
      }
      return {
        success: true,
        message: 'Module fetched successfully',
        data: module,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error while fetching module', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while fetching module', error);
      throw new BadRequestException('Error while fetching module');
    }
  }

  /**
   * Returns every active submodule with its parent module populated.
   */
  async getAllSubModules() {
    try {
      const data = await this.subModuleDB.genericFindAllWithPopulate(
        {
          isActive: true,
        },
        [
          {
            path: SubModuleModelConstants.moduleId,
            select: `${ModuleModelConstants.label} ${ModuleModelConstants.identity}`,
          },
        ],
      );

      return {
        success: true,
        message: 'Submodules fetched successfully',
        data,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error while getting all submodules', error.message);
        throw new BadRequestException('Failed to fetch submodules');
      }
      console.log('Error while getting all submodules', error);
      throw new BadRequestException('Failed to fetch submodules');
    }
  }

  /**
   * Fetches a single submodule by id, with its parent module populated.
   */
  async getSubModuleById(id: string) {
    try {
      const data = await this.subModuleDB.genericFindOneWithPopulate(
        {
          _id: id,
        },
        [
          {
            path: SubModuleModelConstants.moduleId,
            select: `${ModuleModelConstants.label} ${ModuleModelConstants.identity}`,
          },
        ],
      );

      if (!data) {
        throw new BadRequestException('Submodule not found');
      }

      return {
        success: true,
        message: 'Submodule fetched successfully',
        data,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error while fetching submodule', error.message);
        throw new BadRequestException('Failed to fetch submodule');
      }
      console.log('Error while fetching submodule', error);
      throw new BadRequestException('Failed to fetch submodule');
    }
  }

  /**
   * Fetches all active submodules belonging to a specific module.
   */
  async getSubModulesByModuleId(moduleId: string) {
    try {
      const data = await this.subModuleDB.genericFindAllWithPopulate(
        {
          moduleId,
          isActive: true,
        },
        [
          {
            path: SubModuleModelConstants.moduleId,
            select: `${ModuleModelConstants.label} ${ModuleModelConstants.identity}`,
          },
        ],
      );

      return {
        success: true,
        message: 'Submodules fetched successfully',
        data,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log(
          'Error while fetching submodules under modules',
          error.message,
        );
        throw new BadRequestException(
          'Failed to fetch submodules by module id',
        );
      }
      console.log('Error while getting submodules', error);
      throw new BadRequestException('Failed to fetch submodules by module id');
    }
  }

  /**
   * Returns the ObjectId of a module given its identity string.
   */
  async getModuleIdByIdentity(identity: string): Promise<Types.ObjectId> {
    try {
      const module = await this.moduleModel.findOne({
        identity,
      });

      if (!module) {
        throw new BadRequestException(
          `Module not found for identity: ${identity}`,
        );
      }

      return module._id;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error while fetching module by identity', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while fetching module by identity', error);
      throw new BadRequestException('Failed to fetch module by identity');
    }
  }

  /**
   * Returns the ObjectId of a submodule given its identity string.
   */
  async getSubModuleIdByIdentity(identity: string): Promise<Types.ObjectId> {
    try {
      const subModule = await this.subModuleModel.findOne({
        identity,
      });

      if (!subModule) {
        throw new BadRequestException(
          `Sub module not found for identity: ${identity}`,
        );
      }

      return subModule._id;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log(
          'Error while fetching sub module by identity',
          error.message,
        );
        throw new BadRequestException(error.message);
      }
      console.log('Error while fetching sub module by identity', error);
      throw new BadRequestException('Failed to fetch sub module by identity');
    }
  }
}
