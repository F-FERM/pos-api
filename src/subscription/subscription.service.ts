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
  SubscriptionDocument,
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
import { ExtendTrialDto } from './dto/extend-trial.dto';
import { ConvertToPaidDto } from './dto/convert-to-paid.dto';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { LogService } from '../log/log.service';
import { SyncService } from '../sync/sync.service';
import type { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import {
  CompanyStatus,
  CompanySubscriptionStatus,
} from '../utils/enums/company.enums';
import {
  BillingCycle,
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
    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
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
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: 'Failed to create subscription',
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
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: id ? new Types.ObjectId(id) : new Types.ObjectId(),
        description: 'Failed to update subscription',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

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
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: 'Failed to renew subscription',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

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
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: id ? new Types.ObjectId(id) : new Types.ObjectId(),
        description: 'Failed to cancel subscription',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

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
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: 'Failed to extend subscription',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error extending store subscription');
    }
  }

  async extendTrial(
    companyId: string,
    dto: ExtendTrialDto,
    superAdminUserId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(superAdminUserId);

      const compObjId = new Types.ObjectId(companyId);
      const company = await this.companyModel.findOne({
        _id: compObjId,
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException('Company store not found');
      }

      let subscription: SubscriptionDocument | null = await this.subscriptionModel.findOne({
        companyId: compObjId,
        isDeleted: false,
      });

      if (!subscription) {
        subscription = await this.createDefaultSubscriptionForCompany(
          companyId,
          superAdminUserId,
        );
      }

      if (!subscription) {
        throw new BadRequestException('Failed to initialize subscription for store');
      }

      const now = new Date();
      const currentEnd =
        subscription.trialEndDate && new Date(subscription.trialEndDate) > now
          ? new Date(subscription.trialEndDate)
          : now;

      const newTrialEndDate = new Date(
        currentEnd.getTime() + dto.additionalDays * 24 * 60 * 60 * 1000,
      );

      await this.subscriptionModel.updateOne(
        { _id: subscription._id },
        {
          $set: {
            trialEndDate: newTrialEndDate,
            'currentPeriod.endDate': newTrialEndDate,
            isTrial: true,
            status: SubscriptionStatus.TRIAL,
            isSynced: false,
          },
          $push: {
            events: {
              type: SubscriptionEventType.UPGRADED,
              occurredAt: new Date(),
              actorId: new Types.ObjectId(superAdminUserId),
              notes: `Trial extended by ${dto.additionalDays} days. Reason: ${dto.reason || 'Superadmin trial extension'}`,
            },
          },
        },
      );

      // Synchronize Company status & subscriptionId reference
      await this.companyModel.updateOne(
        { _id: compObjId },
        {
          $set: {
            status: CompanyStatus.ACTIVE,
            'subscription.status': CompanySubscriptionStatus.TRIAL,
            'subscription.trialEndDate': newTrialEndDate,
            'subscription.endDate': newTrialEndDate,
            subscriptionId: subscription._id,
            isSynced: false,
          },
        },
      );

      // Synchronize StoreLicense status
      await this.storeLicenseModel.updateOne(
        { companyId: compObjId },
        {
          $set: {
            status: LicenseStatus.REDEEMED,
            expiresAt: newTrialEndDate,
            isSynced: false,
          },
        },
      );

      await this.logService.createLog({
        companyId: compObjId,
        createdBy: new Types.ObjectId(superAdminUserId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(subscription._id),
        description: `Trial extended by ${dto.additionalDays} days for store ${company.name}`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: `Store trial successfully extended by ${dto.additionalDays} days until ${newTrialEndDate.toISOString().split('T')[0]}`,
        data: {
          companyId,
          endDate: newTrialEndDate,
          status: SubscriptionStatus.TRIAL,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(superAdminUserId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: 'Failed to extend store trial',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error extending store trial');
    }
  }

  async convertToPaid(
    companyId: string,
    dto: ConvertToPaidDto,
    superAdminUserId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(superAdminUserId);

      const compObjId = new Types.ObjectId(companyId);
      const company = await this.companyModel.findOne({
        _id: compObjId,
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException('Company store not found');
      }

      let subscription: SubscriptionDocument | null = await this.subscriptionModel.findOne({
        companyId: compObjId,
        isDeleted: false,
      });

      if (!subscription) {
        subscription = await this.createDefaultSubscriptionForCompany(
          companyId,
          superAdminUserId,
        );
      }

      if (!subscription) {
        throw new BadRequestException('Failed to initialize subscription for store');
      }

      const now = new Date();
      const currentEnd =
        subscription.currentPeriod?.endDate && new Date(subscription.currentPeriod.endDate) > now
          ? new Date(subscription.currentPeriod.endDate)
          : now;

      const newEndDate = new Date(
        currentEnd.getTime() + dto.validityMonths * 30 * 24 * 60 * 60 * 1000,
      );

      const newPlanName = dto.planName?.trim() || 'Professional Plan';
      const updatedMaxUsers = dto.maxUsers || subscription.limits?.maxUsers || 5;
      const updatedMaxCounters = dto.maxCounters || subscription.limits?.maxTerminals || 2;

      await this.subscriptionModel.updateOne(
        { _id: subscription._id },
        {
          $set: {
            planName: newPlanName,
            isTrial: false,
            status: SubscriptionStatus.ACTIVE,
            'currentPeriod.endDate': newEndDate,
            'limits.maxUsers': updatedMaxUsers,
            'limits.maxTerminals': updatedMaxCounters,
            trialConvertedAt: new Date(),
            isSynced: false,
          },
          $push: {
            events: {
              type: SubscriptionEventType.TRIAL_CONVERTED,
              occurredAt: new Date(),
              actorId: new Types.ObjectId(superAdminUserId),
              notes: `Trial converted to paid active subscription (${dto.validityMonths} months). Reason: ${dto.reason || 'Superadmin conversion'}`,
            },
          },
        },
      );

      // Synchronize Company status & subscriptionId reference
      await this.companyModel.updateOne(
        { _id: compObjId },
        {
          $set: {
            status: CompanyStatus.ACTIVE,
            maxUsers: updatedMaxUsers,
            maxCounters: updatedMaxCounters,
            'subscription.status': CompanySubscriptionStatus.ACTIVE,
            'subscription.endDate': newEndDate,
            subscriptionId: subscription._id,
            isSynced: false,
          },
        },
      );

      // Synchronize StoreLicense status
      await this.storeLicenseModel.updateOne(
        { companyId: compObjId },
        {
          $set: {
            status: LicenseStatus.REDEEMED,
            isTrial: false,
            expiresAt: newEndDate,
            maxUsers: updatedMaxUsers,
            maxCounters: updatedMaxCounters,
            isSynced: false,
          },
        },
      );

      await this.logService.createLog({
        companyId: compObjId,
        createdBy: new Types.ObjectId(superAdminUserId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(subscription._id),
        description: `Trial converted to paid active subscription (${dto.validityMonths} months) until ${newEndDate.toISOString().split('T')[0]} for store ${company.name}`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: `Store trial successfully converted to paid active subscription until ${newEndDate.toISOString().split('T')[0]}`,
        data: {
          companyId,
          planName: newPlanName,
          isTrial: false,
          endDate: newEndDate,
          status: SubscriptionStatus.ACTIVE,
          maxUsers: updatedMaxUsers,
          maxCounters: updatedMaxCounters,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(superAdminUserId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: 'Failed to convert trial to paid subscription',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error converting trial to paid subscription');
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
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: 'Failed to update subscription status',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

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
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(superAdminId),
        action: LogActions.UPDATE_SUBSCRIPTION,
        entityType: LogEntityType.SUBSCRIPTION,
        entityId: new Types.ObjectId(),
        description: 'Failed to manage store subscription',
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating store subscription');
    }
  }

  async createDefaultSubscriptionForCompany(
    companyId: string,
    userId: string,
    options?: {
      status?: SubscriptionStatus;
      isTrial?: boolean;
      trialEndDate?: Date;
      maxCounters?: number;
      maxUsers?: number;
    },
  ): Promise<SubscriptionDocument> {
    const existing = await this.subscriptionModel.findOne({
      companyId: new Types.ObjectId(companyId),
      isDeleted: false,
    });

    if (existing) return existing;

    const isTrial = options?.isTrial ?? true;
    const status =
      options?.status ||
      (isTrial ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE);
    const now = new Date();
    const trialEndDate =
      options?.trialEndDate ||
      new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const endDate = trialEndDate;

    const created = await this.subscriptionModel.create({
      companyId: new Types.ObjectId(companyId),
      planName: isTrial ? 'Starter Trial Plan' : 'Standard Store Plan',
      status,
      isTrial,
      trialStartDate: isTrial ? now : null,
      trialEndDate: isTrial ? trialEndDate : null,
      currentPeriod: {
        startDate: now,
        endDate,
      },
      currency: 'INR',
      billingCycle: BillingCycle.MONTHLY,
      priceMinor: 0,
      limits: {
        maxUsers: options?.maxUsers ?? 5,
        maxTerminals: options?.maxCounters ?? 2,
        maxProducts: -1,
        maxCustomers: -1,
        maxMonthlyTransactions: -1,
        maxStorageMb: -1,
      },
      events: [
        {
          type: SubscriptionEventType.CREATED,
          occurredAt: now,
          actorId: this.isValidMongoId(userId)
            ? new Types.ObjectId(userId)
            : null,
          previousState: {},
          newState: { status, isTrial },
          notes: 'Auto-created default subscription for company',
        },
      ],
      createdBy: this.isValidMongoId(userId)
        ? new Types.ObjectId(userId)
        : undefined,
      isDeleted: false,
    });

    return created;
  }
}
