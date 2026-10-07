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
        : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

      const created: SubscriptionDocument = await this.genericCreateOne({
        [SubscriptionModelConstants.companyId]: new Types.ObjectId(
          dto.companyId,
        ),
        [SubscriptionModelConstants.planName]: 'Professional Supermarket Plan',
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
        [SubscriptionModelConstants.currency]: dto.currency ?? 'INR',
        [SubscriptionModelConstants.billingCycle]:
          dto.billingCycle ?? 'YEARLY',
        [SubscriptionModelConstants.priceMinor]: dto.priceMinor ?? 0,
        [SubscriptionModelConstants.limits]: {
          maxUsers: 10,
          maxTerminals: 5,
        },
        [SubscriptionModelConstants.events]: [
          {
            type: SubscriptionEventType.CREATED,
            timestamp: new Date(),
            triggeredBy: new Types.ObjectId(userId),
          },
        ],
        [SubscriptionModelConstants.createdBy]: new Types.ObjectId(userId),
      });

      await this.companyService.genericUpdateOne(dto.companyId, {
        $set: {
          'subscription.status': dto.status,
          'subscription.startDate': startDate,
          'subscription.endDate': endDate,
          'subscription.maxUsers': 10,
          'subscription.maxTerminals': 5,
        },
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(created._id),
        description: 'Subscription created for company',
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error creating subscription');
    }
  }

  async updateSubscription(
    id: string,
    dto: UpdateSubscriptionDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const subscription = await this.genericFindOne({ _id: id });
      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      const updated = await this.genericUpdateOne(id, { ...dto });

      await this.logService.createLog({
        companyId: subscription.companyId,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(id),
        description: 'Subscription updated',
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating subscription');
    }
  }

  async renewSubscription(
    companyId: string,
    dto: RenewSubscriptionDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const subscription = await this.genericFindOne({
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!subscription) {
        throw new NotFoundException('Active subscription not found for company');
      }

      const newStartDate = dto.startDate ? new Date(dto.startDate) : new Date();
      const newEndDate = dto.endDate
        ? new Date(dto.endDate)
        : new Date(newStartDate.getTime() + 365 * 24 * 60 * 60 * 1000);

      const updated = await this.genericUpdateOne(subscription._id.toString(), {
        status: SubscriptionStatus.ACTIVE,
        'currentPeriod.startDate': newStartDate,
        'currentPeriod.endDate': newEndDate,
      });

      await this.companyService.genericUpdateOne(companyId, {
        $set: {
          'subscription.status': SubscriptionStatus.ACTIVE,
          'subscription.startDate': newStartDate,
          'subscription.endDate': newEndDate,
        },
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(subscription._id),
        description: 'Subscription renewed successfully',
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription renewed successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error renewing subscription');
    }
  }

  async cancelSubscription(id: string, userId: string, req: AuthedRequest) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const subscription = await this.genericFindOne({ _id: id });
      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      const updated = await this.genericUpdateOne(id, {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      await this.companyService.genericUpdateOne(
        subscription.companyId.toString(),
        {
          $set: {
            'subscription.status': SubscriptionStatus.CANCELLED,
          },
        },
      );

      await this.logService.createLog({
        companyId: subscription.companyId,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(id),
        description: 'Subscription cancelled',
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Subscription cancelled successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error cancelling subscription');
    }
  }

  async getSubscriptionByCompany(companyId: string) {
    try {
      const subscription = await this.subscriptionModel.findOne({
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      return {
        success: true,
        message: 'Company subscription details fetched successfully',
        data: subscription,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching company subscription');
    }
  }

  async getSubscriptionStatus(companyId: string) {
    try {
      const subscription = await this.subscriptionModel.findOne({
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      const now = new Date();
      const isActive =
        subscription &&
        subscription.status === SubscriptionStatus.ACTIVE &&
        subscription.currentPeriod?.endDate &&
        new Date(subscription.currentPeriod.endDate) > now;

      return {
        success: true,
        message: 'Company subscription status checked successfully',
        data: {
          status: subscription?.status || SubscriptionStatus.EXPIRED,
          isActive: !!isActive,
          expiresAt: subscription?.currentPeriod?.endDate || null,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error checking subscription status');
    }
  }

  async getAllSubscriptions(
    userId: string,
    roles: string[],
    query?: { status?: string },
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      const filter: Record<string, unknown> = {
        isDeleted: false,
      };

      if (query?.status) filter.status = query.status;

      const subscriptions = await this.subscriptionModel
        .find(filter)
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: 'All subscriptions fetched successfully',
        data: subscriptions,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching subscriptions');
    }
  }
}
