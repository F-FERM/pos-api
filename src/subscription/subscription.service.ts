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
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import {
  LicenseStatus,
  StoreLicenseDocument,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { UpdateSubscriptionStatusAndDateDto } from './dto/update-subscription-status-and-date.dto';
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
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(StoreLicenseSchemaName)
    private readonly storeLicenseModel: Model<StoreLicenseDocument>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    private readonly logService: LogService,
  ) {
    super(subscriptionModel);
  }

  /**
   * Multi-Schema Atomic Expiration & Status Synchronizer.
   * Updates Subscription, Company, and StoreLicense across schemas in parallel!
   */
  async syncSubscriptionAcrossSchemas(
    companyId: string,
    endDate: Date,
    status: SubscriptionStatus,
    maxCounters?: number,
    maxUsers?: number,
  ): Promise<void> {
    const compObjectId = new Types.ObjectId(companyId);

    const licenseStatus =
      status === SubscriptionStatus.EXPIRED
        ? LicenseStatus.EXPIRED
        : status === SubscriptionStatus.SUSPENDED
          ? LicenseStatus.SUSPENDED
          : LicenseStatus.REDEEMED;

    await Promise.all([
      // 1. Sync Subscriptions Collection
      this.subscriptionModel.updateOne(
        { companyId: compObjectId, isDeleted: false },
        {
          $set: {
            status,
            'currentPeriod.endDate': endDate,
            trialEndDate: endDate,
            ...(maxCounters && { 'limits.maxTerminals': maxCounters }),
            ...(maxUsers && { 'limits.maxUsers': maxUsers }),
          },
        },
      ),
      // 2. Sync Companies Collection
      this.companyModel.updateOne(
        { _id: compObjectId, isDeleted: false },
        {
          $set: {
            'subscription.status': status,
            'subscription.endDate': endDate,
            ...(maxCounters && {
              'subscription.maxCounters': maxCounters,
              maxCounters,
            }),
            ...(maxUsers && { 'subscription.maxUsers': maxUsers, maxUsers }),
          },
        },
      ),
      // 3. Sync StoreLicenses Collection
      this.storeLicenseModel.updateOne(
        { companyId: compObjectId, isDeleted: false },
        {
          $set: {
            status: licenseStatus,
            expiresAt: endDate,
            ...(maxCounters && { maxCounters }),
            ...(maxUsers && { maxUsers }),
          },
        },
      ),
    ]);
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
        companyId: new Types.ObjectId(dto.companyId),
        status: {
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
        companyId: new Types.ObjectId(dto.companyId),
        planName: 'Professional Supermarket Plan',
        status: dto.status,
        isTrial: dto.status === SubscriptionStatus.TRIAL,
        trialStartDate: dto.trialStartDate
          ? new Date(dto.trialStartDate)
          : null,
        trialEndDate: dto.trialEndDate ? new Date(dto.trialEndDate) : null,
        currentPeriod: { startDate, endDate },
        currency: dto.currency ?? 'INR',
        billingCycle: dto.billingCycle ?? 'YEARLY',
        priceMinor: dto.priceMinor ?? 0,
        limits: {
          maxUsers: 10,
          maxTerminals: 5,
        },
        events: [
          {
            type: SubscriptionEventType.CREATED,
            timestamp: new Date(),
            triggeredBy: new Types.ObjectId(userId),
          },
        ],
        createdBy: new Types.ObjectId(userId),
      });

      await this.syncSubscriptionAcrossSchemas(
        dto.companyId,
        endDate,
        dto.status,
        5,
        10,
      );

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(created._id),
        description: 'Subscription created for company with multi-schema sync',
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

      if (dto.status || dto.endDate) {
        const newEndDate = dto.endDate
          ? new Date(dto.endDate)
          : subscription.currentPeriod?.endDate ||
            subscription.trialEndDate ||
            new Date();
        const newStatus = dto.status || subscription.status;

        await this.syncSubscriptionAcrossSchemas(
          subscription.companyId.toString(),
          newEndDate,
          newStatus,
        );
      }

      await this.logService.createLog({
        companyId: subscription.companyId,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(id),
        description: 'Subscription updated with multi-schema sync',
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
        throw new NotFoundException(
          'Active subscription not found for company',
        );
      }

      const newStartDate = dto.startDate ? new Date(dto.startDate) : new Date();
      const newEndDate = dto.endDate
        ? new Date(dto.endDate)
        : new Date(newStartDate.getTime() + 365 * 24 * 60 * 60 * 1000);

      await this.syncSubscriptionAcrossSchemas(
        companyId,
        newEndDate,
        SubscriptionStatus.ACTIVE,
      );

      const updated = await this.genericFindOne({ _id: subscription._id });

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

      const endDate =
        subscription.currentPeriod?.endDate ||
        subscription.trialEndDate ||
        new Date();

      await this.syncSubscriptionAcrossSchemas(
        subscription.companyId.toString(),
        endDate,
        SubscriptionStatus.CANCELLED,
      );

      const updated = await this.genericFindOne({ _id: id });

      await this.logService.createLog({
        companyId: subscription.companyId,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(id),
        description: 'Subscription cancelled with multi-schema sync',
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
      const endDate =
        subscription?.currentPeriod?.endDate || subscription?.trialEndDate;
      const isActive =
        subscription &&
        subscription.status === SubscriptionStatus.ACTIVE &&
        endDate &&
        new Date(endDate) > now;

      return {
        success: true,
        message: 'Company subscription status checked successfully',
        data: {
          status: subscription?.status || SubscriptionStatus.EXPIRED,
          isActive: !!isActive,
          endDate: endDate || null,
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

  async extendSubscription(
    companyId: string,
    daysExtension: number,
    superAdminId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(superAdminId);

      const subscription = await this.subscriptionModel.findOne({
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!subscription) {
        throw new NotFoundException('Subscription not found for this company');
      }

      const currentEnd =
        subscription.currentPeriod?.endDate ||
        subscription.trialEndDate ||
        new Date();

      const newEndDate = new Date(
        new Date(currentEnd).getTime() + daysExtension * 24 * 60 * 60 * 1000,
      );

      await this.syncSubscriptionAcrossSchemas(
        companyId,
        newEndDate,
        SubscriptionStatus.ACTIVE,
      );

      const updated = await this.subscriptionModel.findOne({
        _id: subscription._id,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(subscription._id),
        description: `Superadmin extended subscription by ${daysExtension} days. New expiration synced across all schemas to: ${newEndDate.toISOString()}`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: `Subscription extended by ${daysExtension} days successfully and synced across all schemas`,
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error extending store subscription');
    }
  }

  async updateSubscriptionStatus(
    companyId: string,
    status: SubscriptionStatus,
    superAdminId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(superAdminId);

      const subscription = await this.subscriptionModel.findOne({
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!subscription) {
        throw new NotFoundException('Subscription not found for this company');
      }

      const currentEnd =
        subscription.currentPeriod?.endDate ||
        subscription.trialEndDate ||
        new Date();

      await this.syncSubscriptionAcrossSchemas(companyId, currentEnd, status);

      const updated = await this.subscriptionModel.findOne({
        _id: subscription._id,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(subscription._id),
        description: `Superadmin changed subscription status to ${status} (synced across all schemas)`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: `Subscription status updated to ${status} successfully across all schemas`,
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating subscription status');
    }
  }

  async manageSubscription(
    companyId: string,
    dto: UpdateSubscriptionStatusAndDateDto,
    superAdminId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(superAdminId);

      const subscription = await this.subscriptionModel.findOne({
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!subscription) {
        throw new NotFoundException('Subscription not found for this company');
      }

      const newEndDate = dto.endDate
        ? new Date(dto.endDate)
        : subscription.currentPeriod?.endDate ||
          subscription.trialEndDate ||
          new Date();

      const newStatus = dto.status || subscription.status;

      await this.syncSubscriptionAcrossSchemas(
        companyId,
        newEndDate,
        newStatus,
        dto.maxCounters,
        dto.maxUsers,
      );

      const updated = await this.subscriptionModel.findOne({
        _id: subscription._id,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(subscription._id),
        description: `Superadmin managed subscription: status='${newStatus}', endDate=${newEndDate.toISOString()}`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
        additionalData: {
          notes: dto.notes,
        },
      });

      return {
        success: true,
        message:
          'Subscription status and end date updated successfully across all schemas',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating store subscription');
    }
  }
}
