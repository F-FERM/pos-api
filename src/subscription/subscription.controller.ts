import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Subscriptions')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @ApiOperation({ summary: 'Create subscription (Superadmin)' })
  @CheckPermission({
    subModule: SUB_MODULES.SUBSCRIPTION,
    action: ACTIONS.CREATE,
  })
  @Post()
  createSubscription(
    @Body() dto: CreateSubscriptionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.subscriptionService.createSubscription(
      dto,
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Update subscription (Superadmin)' })
  @CheckPermission({
    subModule: SUB_MODULES.SUBSCRIPTION,
    action: ACTIONS.UPDATE,
  })
  @Patch(':id')
  updateSubscription(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.subscriptionService.updateSubscription(
      id,
      dto,
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Renew subscription (Superadmin)' })
  @CheckPermission({
    subModule: SUB_MODULES.SUBSCRIPTION,
    action: ACTIONS.UPDATE,
  })
  @Post('renew/:companyId')
  renewSubscription(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
    @Body() dto: RenewSubscriptionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.subscriptionService.renewSubscription(
      companyId,
      dto,
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Cancel subscription (Superadmin)' })
  @CheckPermission({
    subModule: SUB_MODULES.SUBSCRIPTION,
    action: ACTIONS.DELETE,
  })
  @Patch(':id/cancel')
  cancelSubscription(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.subscriptionService.cancelSubscription(
      id,
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Get subscription by company id' })
  @CheckPermission({
    subModule: SUB_MODULES.SUBSCRIPTION,
    action: ACTIONS.READ,
  })
  @Get('company/:companyId')
  getSubscriptionByCompany(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
  ) {
    return this.subscriptionService.getSubscriptionByCompany(companyId);
  }

  @ApiOperation({ summary: 'Get subscription status by company id' })
  @CheckPermission({
    subModule: SUB_MODULES.SUBSCRIPTION,
    action: ACTIONS.READ,
  })
  @Get('status/:companyId')
  getSubscriptionStatus(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
  ) {
    return this.subscriptionService.getSubscriptionStatus(companyId);
  }

  @ApiOperation({ summary: 'Get all subscriptions (Superadmin)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'planCode', required: false })
  @CheckPermission({
    subModule: SUB_MODULES.SUBSCRIPTION,
    action: ACTIONS.READ,
  })
  @Get()
  getAllSubscriptions(
    @Req() req: AuthedRequest,
    @Query('status') status?: string,
    @Query('planCode') planCode?: string,
  ) {
    return this.subscriptionService.getAllSubscriptions(
      req.user.userId,
      req.user.roles,
      { status, planCode },
    );
  }
}
