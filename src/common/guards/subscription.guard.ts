import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { SubscriptionService } from '../../subscription/subscription.service';
import { SKIP_SUBSCRIPTION_KEY } from '../decorators/skip-subscription.decorator';
import { IS_PUBLIC_KEY } from '../../auth/public.decorator';
import { Role } from '../../utils/role.enum';
import { SubscriptionStatus } from '../../utils/enums/subscription.enums';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const skipSubscription = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || skipSubscription) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    // Superadmin bypass
    if (user?.roles?.includes(Role.superadmin)) {
      return true;
    }

    // Validate user has company
    if (!user?.companyId) {
      throw new ForbiddenException('No company associated with this user');
    }

    const companyId: string = user.companyId.toString();

    // Use subscription service to find company subscription
    const subscription = await this.subscriptionService.genericFindOne({
      companyId: new Types.ObjectId(companyId),
      isDeleted: false,
    });

    if (!subscription) {
      throw new ForbiddenException(
        'No subscription found for this company. Please contact support.',
      );
    }

    const now = new Date();

    // Check if subscription is cancelled
    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new ForbiddenException(
        'Your store subscription has been cancelled. Please contact support to reactivate.',
      );
    }

    // Check if subscription is suspended
    if (subscription.status === SubscriptionStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Your store subscription is suspended. Please contact store administration.',
      );
    }

    // Check if trial has expired
    if (subscription.isTrial && subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      if (trialEnd < now) {
        await this.subscriptionService.genericUpdateOne(
          subscription._id.toString(),
          {
            status: SubscriptionStatus.EXPIRED,
          },
        );
        throw new ForbiddenException(
          'Your 14-day store free trial has expired. Please contact support to upgrade to a paid license.',
        );
      }
    }

    // Check subscription end date
    const endDate =
      subscription.currentPeriod?.endDate || subscription.trialEndDate;

    if (endDate && new Date(endDate) < now) {
      await this.subscriptionService.genericUpdateOne(
        subscription._id.toString(),
        {
          status: SubscriptionStatus.EXPIRED,
        },
      );
      throw new ForbiddenException(
        'Your subscription has expired. Please renew your subscription to continue using the service.',
      );
    }

    // Check if subscription is cancelled
    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new ForbiddenException(
        'Your subscription has been cancelled. Please contact support.',
      );
    }

    // Check if subscription is suspended
    if (subscription.status === SubscriptionStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Your subscription has been suspended. Please contact support.',
      );
    }

    // Calculate days remaining
    let daysRemaining: number | null = null;
    if (endDate) {
      daysRemaining = Math.ceil(
        (new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    // Attach subscription details to request object
    request.subscription = {
      id: subscription._id,
      planName: subscription.planName,
      isTrial: subscription.isTrial,
      daysRemaining,
      endDate,
      status: subscription.status,
      limits: subscription.limits,
    };

    if (daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0) {
      request.subscription.expiringSoon = true;
    }

    return true;
  }
}
