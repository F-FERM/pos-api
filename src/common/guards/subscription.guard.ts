import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '../../utils/enums/subscription.enums';
import { Role } from '../../utils/role.enum';
import { SubscriptionService } from '../../subscription/subscription.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if subscription check is skipped
    const skip = this.reflector.getAllAndOverride<boolean>('skipSubscription', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return true;

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

    //  Use subscription service to find subscription
    const subscription = await this.subscriptionService.genericFindOne({
      companyId: companyId,
    });

    // Check if subscription exists
    if (!subscription) {
      throw new ForbiddenException(
        'No subscription found. Please contact your administrator.',
      );
    }

    // Check if subscription is active
    if (!subscription.isActive) {
      throw new ForbiddenException(
        'Your subscription is inactive. Please renew to continue.',
      );
    }

    const now = new Date();

    // Check trial expiration using trialEndDate
    if (subscription.isTrial && subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      if (trialEnd < now) {
        // Auto-deactivate expired trial
        await this.subscriptionService.genericUpdateOne(
          subscription._id.toString(),
          {
            isActive: false,
            status: SubscriptionStatus.EXPIRED,
          },
        );
        throw new ForbiddenException(
          'Your trial has expired. Please upgrade to a paid plan to continue.',
        );
      }
    }

    // Check subscription end date
    if (subscription.endDate && new Date(subscription.endDate) < now) {
      // Auto-deactivate expired subscription
      await this.subscriptionService.genericUpdateOne(
        subscription._id.toString(),
        {
          isActive: false,
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

    // Calculate days remaining using endDate
    let daysRemaining: number | null = null;
    if (subscription.endDate) {
      daysRemaining = Math.ceil(
        (new Date(subscription.endDate).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );
    }

    // Attach subscription info to request for later use
    request.subscription = {
      id: subscription._id,
      plan: subscription.plan,
      isTrial: subscription.isTrial,
      daysRemaining,
      endDate: subscription.endDate,
      trialEndDate: subscription.trialEndDate,
      status: subscription.status,
      features: subscription.features,
      limits: subscription.limits,
    };

    // If expiring soon (less than 7 days), attach warning flag
    if (daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0) {
      request.subscription.expiringSoon = true;
    }

    return true;
  }
}
