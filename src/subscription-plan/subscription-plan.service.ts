import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
  SubscriptionPlanModelConstants,
  SubscriptionPlanSchemaName,
} from '../models/subscription-plan.schema';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { SUBSCRIPTION_PLANS_SEED } from '../common/seeds/subscription-plans.seed';
import { LogService } from '../log/log.service';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { SubscriptionPlanStatus } from '../utils/enums/subscription.enums';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';

@Injectable()
export class SubscriptionPlanService
  extends GenericDatabase<Model<SubscriptionPlanDocument>>
  implements OnModuleInit
{
  constructor(
    @InjectModel(SubscriptionPlanSchemaName)
    private readonly subscriptionPlanModel: Model<SubscriptionPlanDocument>,
    private readonly logService: LogService,
    private readonly userService: UserService,
  ) {
    super(subscriptionPlanModel);
  }

  async onModuleInit() {
    await this.seedSubscriptionPlans();
  }

  async seedSubscriptionPlans(): Promise<void> {
    try {
      for (const planData of SUBSCRIPTION_PLANS_SEED) {
        const existing: SubscriptionPlanDocument | null =
          await this.genericFindOne({
            [SubscriptionPlanModelConstants.code]: planData.code,
          });

        if (!existing) {
          await this.genericCreateOne({
            ...planData,
            [SubscriptionPlanModelConstants.createdBy]: null,
          });
          console.log(`Seeded plan: ${planData.name}`);
        }
      }
    } catch (error) {
      console.error('Error seeding subscription plans:', error);
      throw error;
    }
  }

  async createCustomPlan(
    dto: CreateSubscriptionPlanDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const existing: SubscriptionPlanDocument | null =
        await this.genericFindOne({
          [SubscriptionPlanModelConstants.code]: dto.code.toUpperCase(),
        });
      if (existing) {
        throw new BadRequestException('Plan code already exists');
      }

      if (dto.isDefault) {
        await this.subscriptionPlanModel.updateMany(
          { [SubscriptionPlanModelConstants.isDefault]: true },
          { [SubscriptionPlanModelConstants.isDefault]: false },
        );
      }

      const plan: SubscriptionPlanDocument = await this.genericCreateOne({
        ...dto,
        [SubscriptionPlanModelConstants.code]: dto.code.toUpperCase(),
        [SubscriptionPlanModelConstants.createdBy]: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: null,
        action: LogActions.CREATE_SUBSCRIPTION_PLAN,
        entityType: LogEntityType.SUBSCRIPTION_PLAN,
        entityId: new Types.ObjectId(plan._id),
        description: `Subscription plan ${plan[SubscriptionPlanModelConstants.name]} created`,
        path: req.url,
        additionalData: {
          newData: plan.toJSON(),
          oldData: null,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription plan created successfully',
        data: plan,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: null,
        action: LogActions.CREATE_SUBSCRIPTION_PLAN,
        entityType: LogEntityType.SUBSCRIPTION_PLAN,
        entityId: new Types.ObjectId(),
        description: `Failed to create subscription plan`,
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
          dto,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Failed to create subscription plan');
    }
  }

  async updatePlan(
    planId: string,
    dto: UpdateSubscriptionPlanDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const plan: SubscriptionPlanDocument | null = await this.genericFindOne({
        _id: planId,
      });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      if (dto.code) {
        const dup: SubscriptionPlanDocument | null = await this.genericFindOne({
          [SubscriptionPlanModelConstants.code]: dto.code.toUpperCase(),
          _id: { $ne: planId },
        });
        if (dup) throw new BadRequestException('Plan code already exists');
      }

      if (dto.isDefault === true) {
        await this.subscriptionPlanModel.updateMany(
          {
            [SubscriptionPlanModelConstants.isDefault]: true,
            _id: { $ne: planId },
          },
          { [SubscriptionPlanModelConstants.isDefault]: false },
        );
      }

      const updatePayload: Record<string, unknown> = { ...dto };
      if (dto.code) {
        updatePayload[SubscriptionPlanModelConstants.code] =
          dto.code.toUpperCase();
      }

      const updated: SubscriptionPlanDocument | null =
        await this.genericUpdateOne(planId, updatePayload);

      await this.logService.createLog({
        companyId: null,
        action: LogActions.UPDATE_SUBSCRIPTION_PLAN,
        entityType: LogEntityType.SUBSCRIPTION_PLAN,
        entityId: new Types.ObjectId(planId),
        description: `Subscription plan ${plan[SubscriptionPlanModelConstants.name]} updated`,
        path: req.url,
        additionalData: {
          oldData: plan.toJSON(),
          newData: updated?.toJSON() ?? null,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Plan updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: null,
        action: LogActions.UPDATE_SUBSCRIPTION_PLAN,
        entityType: LogEntityType.SUBSCRIPTION_PLAN,
        entityId: new Types.ObjectId(planId),
        description: `Failed to update subscription plan`,
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
          dto,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Failed to update plan');
    }
  }

  async deletePlan(planId: string, userId: string, req: AuthedRequest) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const plan: SubscriptionPlanDocument | null = await this.genericFindOne({
        _id: planId,
      });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      if (plan[SubscriptionPlanModelConstants.isDefault]) {
        throw new BadRequestException('Cannot delete the default plan');
      }

      await this.genericDeleteOne(planId);

      await this.logService.createLog({
        companyId: null,
        action: LogActions.DELETE_SUBSCRIPTION_PLAN,
        entityType: LogEntityType.SUBSCRIPTION_PLAN,
        entityId: new Types.ObjectId(planId),
        description: `Subscription plan ${plan[SubscriptionPlanModelConstants.name]} deleted`,
        path: req.url,
        additionalData: { deletedData: plan.toJSON() },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Plan deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: null,
        action: LogActions.DELETE_SUBSCRIPTION_PLAN,
        entityType: LogEntityType.SUBSCRIPTION_PLAN,
        entityId: new Types.ObjectId(planId),
        description: `Failed to delete subscription plan`,
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Failed to delete plan');
    }
  }

  async getAllActivePlans() {
    const plans: SubscriptionPlanDocument[] = await this.genericFindAll({
      [SubscriptionPlanModelConstants.status]: SubscriptionPlanStatus.ACTIVE,
      [SubscriptionPlanModelConstants.isPublic]: true,
    });

    return {
      success: true,
      message: 'Plans fetched successfully',
      data: plans,
      statusCode: HttpStatus.OK,
    };
  }

  async getAllPlans(userId: string) {
    await this.userService.validateAuthenticatedUser(userId);

    const plans: SubscriptionPlanDocument[] = await this.genericFindAll({});

    return {
      success: true,
      message: 'Plans fetched successfully',
      data: plans,
      statusCode: HttpStatus.OK,
    };
  }

  async getPlanById(planId: string) {
    const plan: SubscriptionPlanDocument | null = await this.genericFindOne({
      _id: planId,
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return {
      success: true,
      message: 'Plan fetched successfully',
      data: plan,
      statusCode: HttpStatus.OK,
    };
  }

  async getPlanByCode(code: string) {
    const plan: SubscriptionPlanDocument | null = await this.genericFindOne({
      [SubscriptionPlanModelConstants.code]: code.toUpperCase(),
      [SubscriptionPlanModelConstants.status]: SubscriptionPlanStatus.ACTIVE,
    });

    if (!plan) {
      throw new NotFoundException(`Plan "${code}" not found`);
    }

    return {
      success: true,
      message: 'Plan fetched successfully',
      data: plan,
      statusCode: HttpStatus.OK,
    };
  }

  async togglePlanStatus(planId: string, userId: string, req: AuthedRequest) {
    const ipAddress: string = await this.getClientIpAddress(req);
    await this.userService.validateAuthenticatedUser(userId);

    const plan: SubscriptionPlanDocument | null = await this.genericFindOne({
      _id: planId,
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const newStatus =
      plan[SubscriptionPlanModelConstants.status] ===
      SubscriptionPlanStatus.ACTIVE
        ? SubscriptionPlanStatus.ARCHIVED
        : SubscriptionPlanStatus.ACTIVE;

    const updated: SubscriptionPlanDocument | null =
      await this.genericUpdateOne(planId, {
        [SubscriptionPlanModelConstants.status]: newStatus,
      });

    await this.logService.createLog({
      companyId: null,
      action: LogActions.UPDATE_SUBSCRIPTION_PLAN,
      entityType: LogEntityType.SUBSCRIPTION_PLAN,
      entityId: new Types.ObjectId(planId),
      description: `Subscription plan ${plan[SubscriptionPlanModelConstants.name]} status changed to ${newStatus}`,
      path: req.url,
      additionalData: {
        oldData: plan.toJSON(),
        newData: updated?.toJSON() ?? null,
      },
      createdBy: new Types.ObjectId(userId),
      ipAddress,
      status: LogStatus.SUCCESS,
    });

    return {
      success: true,
      message: `Plan ${newStatus === SubscriptionPlanStatus.ACTIVE ? 'activated' : 'archived'} successfully`,
      data: updated,
      statusCode: HttpStatus.OK,
    };
  }
}
