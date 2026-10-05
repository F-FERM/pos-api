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
import { GenericDatabase } from '../helper/genericDatabase';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionModelConstants,
  SubscriptionSchemaName,
} from '../models/subscription.schema';
import {
  SubscriptionPlanDocument,
  SubscriptionPlanModelConstants,
  SubscriptionPlanSchemaName,
} from '../models/subscription-plan.schema';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { LogService } from '../log/log.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';
import {
  SubscriptionEventType,
  SubscriptionStatus,
} from '../utils/enums/subscription.enums';

@Injectable()
export class SubscriptionService extends GenericDatabase<
  Model<SubscriptionDocument>
> {
  constructor(
    @InjectModel(SubscriptionSchemaName)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlanSchemaName)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    private readonly logService: LogService,
  ) {
    super(subscriptionModel);
  }

  async createSubscription(
    dto: CreateSubscriptionDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const plan = await this.planModel.findById(dto.planId);
      if (!plan) {
        throw new NotFoundException('Subscription plan not found');
      }

      const existing: SubscriptionDocument | null = await this.genericFindOne({
        [SubscriptionModelConstants.companyId]: new Types.ObjectId(
          dto.companyId,
        ),
        [SubscriptionModelConstants.status]: {
          $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
        },
      });
      if (existing) {
        throw new BadRequestException(
          'Company already has an active or trial subscription',
        );
      }

      const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
      const endDate = dto.endDate
        ? new Date(dto.endDate)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const created: SubscriptionDocument = await this.genericCreateOne({
        [SubscriptionModelConstants.companyId]: new Types.ObjectId(
          dto.companyId,
        ),
        [SubscriptionModelConstants.planId]: new Types.ObjectId(dto.planId),
        [SubscriptionModelConstants.planCode]:
          plan[SubscriptionPlanModelConstants.code],
        [SubscriptionModelConstants.planName]:
          plan[SubscriptionPlanModelConstants.name],
        [SubscriptionModelConstants.status]: dto.status,
        [SubscriptionModelConstants.isTrial]:
          dto.status === SubscriptionStatus.TRIAL,
        [SubscriptionModelConstants.trialStartDate]: dto.trialStartDate
          ? new Date(dto.trialStartDate)
          : null,
        [SubscriptionModelConstants.trialEndDate]: dto.trialEndDate
          ? new Date(dto.trialEndDate)
          : null,
        [SubscriptionModelConstants.currentPeriod]: { startDate, endDate },
        [SubscriptionModelConstants.currency]:
          dto.currency ?? plan[SubscriptionPlanModelConstants.pricing].currency,
        [SubscriptionModelConstants.billingCycle]:
          dto.billingCycle ??
          plan[SubscriptionPlanModelConstants.pricing].billingCycle,
        [SubscriptionModelConstants.priceMinor]:
          dto.priceMinor ??
          plan[SubscriptionPlanModelConstants.pricing].priceMinor,
        [SubscriptionModelConstants.limits]:
          plan[SubscriptionPlanModelConstants.limits],
        [SubscriptionModelConstants.events]: [
          {
            type: SubscriptionEventType.CREATED,
            occurredAt: new Date(),
            actorId: new Types.ObjectId(userId),
            previousState: {},
            newState: { status: dto.status, planCode: plan.code },
          },
        ],
        [SubscriptionModelConstants.createdBy]: new Types.ObjectId(userId),
      });

      await this.companyService.genericUpdateOne(dto.companyId, {
        'subscription.planId': new Types.ObjectId(dto.planId),
        'subscription.planCode': plan[SubscriptionPlanModelConstants.code],
        'subscription.status': dto.status,
        'subscription.startDate': startDate,
        'subscription.endDate': endDate,
        'subscription.trialStartDate': dto.trialStartDate
          ? new Date(dto.trialStartDate)
          : null,
        'subscription.trialEndDate': dto.trialEndDate
          ? new Date(dto.trialEndDate)
          : null,
        'subscription.maxUsers':
          plan[SubscriptionPlanModelConstants.limits].maxUsers,
        'subscription.maxTerminals':
          plan[SubscriptionPlanModelConstants.limits].maxTerminals,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        action: LogActions.CREATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(created._id),
        description: `Subscription created for plan ${
          plan[SubscriptionPlanModelConstants.code]
        }`,
        path: req.url,
        additionalData: {
          newData: created.toJSON(),
          oldData: null,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        action: LogActions.CREATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: `Failed to create subscription`,
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
      throw new BadRequestException('Failed to create subscription');
    }
  }

  async updateSubscription(
    id: string,
    dto: UpdateSubscriptionDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const subscription: SubscriptionDocument | null =
        await this.genericFindOne({ _id: id });
      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      const update: Record<string, unknown> = {};
      if (dto.status) update[SubscriptionModelConstants.status] = dto.status;
      if (dto.billingCycle) {
        update[SubscriptionModelConstants.billingCycle] = dto.billingCycle;
      }
      if (dto.priceMinor !== undefined) {
        update[SubscriptionModelConstants.priceMinor] = dto.priceMinor;
      }
      if (dto.currency) {
        update[SubscriptionModelConstants.currency] = dto.currency;
      }
      if (dto.autoRenew !== undefined) {
        update[SubscriptionModelConstants.autoRenew] = dto.autoRenew;
      }
      if (dto.cancellationReason !== undefined) {
        update.cancellationReason =
          dto.cancellationReason;
      }
      if (dto.startDate || dto.endDate) {
        update[SubscriptionModelConstants.currentPeriod] = {
          startDate: dto.startDate
            ? new Date(dto.startDate)
            : subscription[SubscriptionModelConstants.currentPeriod].startDate,
          endDate: dto.endDate
            ? new Date(dto.endDate)
            : subscription[SubscriptionModelConstants.currentPeriod].endDate,
        };
      }
      if (dto.trialStartDate) {
        update[SubscriptionModelConstants.trialStartDate] = new Date(
          dto.trialStartDate,
        );
      }
      if (dto.trialEndDate) {
        update[SubscriptionModelConstants.trialEndDate] = new Date(
          dto.trialEndDate,
        );
      }

      update[SubscriptionModelConstants.events] = [
        ...subscription[SubscriptionModelConstants.events],
        {
          type: SubscriptionEventType.RENEWED,
          occurredAt: new Date(),
          actorId: new Types.ObjectId(userId),
          previousState: subscription.toJSON(),
          newState: update,
        },
      ];

      const updated: SubscriptionDocument | null = await this.genericUpdateOne(
        id,
        update,
      );

      await this.logService.createLog({
        companyId: subscription[
          SubscriptionModelConstants.companyId
        ] as Types.ObjectId,
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(id),
        description: `Subscription updated`,
        path: req.url,
        additionalData: {
          oldData: subscription.toJSON(),
          newData: updated?.toJSON() ?? null,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(id),
        description: `Failed to update subscription`,
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
      throw new BadRequestException('Failed to update subscription');
    }
  }

  async renewSubscription(
    companyId: string,
    dto: RenewSubscriptionDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const subscription: SubscriptionDocument | null =
        await this.genericFindOne({
          [SubscriptionModelConstants.companyId]: new Types.ObjectId(companyId),
          [SubscriptionModelConstants.status]: {
            $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
          },
        });

      if (!subscription) {
        throw new NotFoundException('Active subscription not found');
      }

      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);

      const update: Record<string, unknown> = {
        [SubscriptionModelConstants.status]: SubscriptionStatus.ACTIVE,
        [SubscriptionModelConstants.isTrial]: false,
        [SubscriptionModelConstants.currentPeriod]: { startDate, endDate },
        [SubscriptionModelConstants.events]: [
          ...subscription[SubscriptionModelConstants.events],
          {
            type: SubscriptionEventType.RENEWED,
            occurredAt: new Date(),
            actorId: new Types.ObjectId(userId),
            previousState: {
              startDate:
                subscription[SubscriptionModelConstants.currentPeriod]
                  .startDate,
              endDate:
                subscription[SubscriptionModelConstants.currentPeriod].endDate,
            },
            newState: { startDate, endDate },
          },
        ],
      };

      if (dto.billingCycle) {
        update[SubscriptionModelConstants.billingCycle] = dto.billingCycle;
      }
      if (dto.priceMinor !== undefined) {
        update[SubscriptionModelConstants.priceMinor] = dto.priceMinor;
      }

      const updated: SubscriptionDocument | null = await this.genericUpdateOne(
        subscription._id.toString(),
        update,
      );

      await this.companyService.genericUpdateOne(companyId, {
        'subscription.status': SubscriptionStatus.ACTIVE,
        'subscription.startDate': startDate,
        'subscription.endDate': endDate,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(subscription._id),
        description: `Subscription renewed`,
        path: req.url,
        additionalData: {
          oldData: subscription.toJSON(),
          newData: updated?.toJSON() ?? null,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription renewed successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: `Failed to renew subscription`,
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
      throw new BadRequestException('Failed to renew subscription');
    }
  }

  async cancelSubscription(id: string, userId: string, req: AuthedRequest) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const subscription: SubscriptionDocument | null =
        await this.genericFindOne({ _id: id });
      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      const now = new Date();
      const updated: SubscriptionDocument | null = await this.genericUpdateOne(
        id,
        {
          [SubscriptionModelConstants.status]: SubscriptionStatus.CANCELLED,
          [SubscriptionModelConstants.cancelledAt]: now,
          [SubscriptionModelConstants.events]: [
            ...subscription[SubscriptionModelConstants.events],
            {
              type: SubscriptionEventType.CANCELLED,
              occurredAt: now,
              actorId: new Types.ObjectId(userId),
              previousState: {
                status: subscription[SubscriptionModelConstants.status],
              },
              newState: { status: SubscriptionStatus.CANCELLED },
            },
          ],
        },
      );

      await this.companyService.genericUpdateOne(
        subscription[SubscriptionModelConstants.companyId].toString(),
        { 'subscription.status': SubscriptionStatus.CANCELLED },
      );

      await this.logService.createLog({
        companyId: subscription[
          SubscriptionModelConstants.companyId
        ] as Types.ObjectId,
        action: LogActions.DELETE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(id),
        description: `Subscription cancelled`,
        path: req.url,
        additionalData: {
          oldData: subscription.toJSON(),
          newData: updated?.toJSON() ?? null,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription cancelled successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(),
        action: LogActions.DELETE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(id),
        description: `Failed to cancel subscription`,
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
        },
        createdBy: new Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  async getSubscriptionByCompany(companyId: string) {
    const subscription: SubscriptionDocument | null = await this.genericFindOne(
      {
        [SubscriptionModelConstants.companyId]: new Types.ObjectId(companyId),
      },
    );

    if (!subscription) {
      return {
        success: true,
        message: 'No subscription found for this company',
        data: null,
        statusCode: HttpStatus.OK,
      };
    }

    const plan: SubscriptionPlanDocument | null = await this.planModel.findById(
      subscription[SubscriptionModelConstants.planId],
    );

    return {
      success: true,
      message: 'Subscription fetched successfully',
      data: { subscription, plan },
      statusCode: HttpStatus.OK,
    };
  }

  async getSubscriptionStatus(companyId: string) {
    const subscription: SubscriptionDocument | null = await this.genericFindOne(
      {
        [SubscriptionModelConstants.companyId]: new Types.ObjectId(companyId),
      },
    );

    if (!subscription) {
      return {
        hasSubscription: false,
        status: SubscriptionStatus.CANCELLED,
        message: 'No subscription found',
      };
    }

    const now = new Date();
    const endDate =
      subscription[SubscriptionModelConstants.currentPeriod].endDate;
    const isExpired = endDate < now;
    const isTrial = subscription[SubscriptionModelConstants.isTrial];
    const trialEnd = subscription[SubscriptionModelConstants.trialEndDate];
    const isTrialExpired = isTrial && trialEnd !== null && trialEnd < now;

    const isActive =
      subscription[SubscriptionModelConstants.status] ===
        SubscriptionStatus.ACTIVE &&
      !isExpired &&
      !isTrialExpired;

    const daysRemaining = Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      hasSubscription: true,
      isActive,
      status: subscription[SubscriptionModelConstants.status],
      planCode: subscription[SubscriptionModelConstants.planCode],
      isTrial,
      startDate:
        subscription[SubscriptionModelConstants.currentPeriod].startDate,
      endDate,
      trialEndDate: trialEnd,
      daysRemaining,
      limits: subscription[SubscriptionModelConstants.limits],
      isExpired: isExpired || isTrialExpired,
    };
  }

  async getAllSubscriptions(
    userId: string,
    roles: string[],
    filters?: {
      status?: string;
      planCode?: string;
    },
  ) {
    await this.userService.validateAuthenticatedUser(userId);

    const query: Record<string, unknown> = {
      [SubscriptionModelConstants.isDeleted]: false,
    };

    const isSuperAdmin = roles.includes(Role.superadmin);
    if (!isSuperAdmin) {
      // Non-superadmins see nothing here — but keep the guard to be explicit
      throw new BadRequestException(
        'Only super admins can list all subscriptions',
      );
    }

    if (filters?.status) {
      query[SubscriptionModelConstants.status] = filters.status;
    }
    if (filters?.planCode) {
      query[SubscriptionModelConstants.planCode] = filters.planCode;
    }

    const subscriptions: SubscriptionDocument[] =
      await this.genericFindAll(query);

    return {
      success: true,
      message: 'Subscriptions fetched successfully',
      data: subscriptions,
      count: subscriptions.length,
      statusCode: HttpStatus.OK,
    };
  }
}
