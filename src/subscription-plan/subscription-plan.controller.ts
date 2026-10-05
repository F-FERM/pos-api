import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { SubscriptionPlanService } from './subscription-plan.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlanController {
  constructor(
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

  // @ApiOperation({ summary: 'Get all active subscription plans' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.SUBSCRIPTION_PLAN,
  //   action: ACTIONS.READ,
  // })
  // @Get()
  // getAllActivePlans() {
  //   return this.subscriptionPlanService.getAllActivePlans();
  // }

  // @ApiOperation({ summary: 'Get all subscription plans (Superadmin)' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.SUBSCRIPTION_PLAN,
  //   action: ACTIONS.READ,
  // })
  // @Get('all')
  // getAllPlans(@Req() req: AuthedRequest) {
  //   return this.subscriptionPlanService.getAllPlans(req.user.userId);
  // }

  // @ApiOperation({ summary: 'Get subscription plan by id' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.SUBSCRIPTION_PLAN,
  //   action: ACTIONS.READ,
  // })
  // @Get(':id')
  // getPlanById(@Param('id', ParseObjectIdPipe) id: string) {
  //   return this.subscriptionPlanService.getPlanById(id);
  // }

  // @ApiOperation({ summary: 'Get subscription plan by code' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.SUBSCRIPTION_PLAN,
  //   action: ACTIONS.READ,
  // })
  // @Get('code/:code')
  // getPlanByCode(@Param('code') code: string) {
  //   return this.subscriptionPlanService.getPlanByCode(code);
  // }

  // @ApiOperation({ summary: 'Create subscription plan (Superadmin)' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.SUBSCRIPTION_PLAN,
  //   action: ACTIONS.CREATE,
  // })
  // @Post()
  // createCustomPlan(
  //   @Body() dto: CreateSubscriptionPlanDto,
  //   @Req() req: AuthedRequest,
  // ) {
  //   return this.subscriptionPlanService.createCustomPlan(
  //     dto,
  //     req.user.userId,
  //     req,
  //   );
  // }

  // @ApiOperation({ summary: 'Update subscription plan (Superadmin)' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.SUBSCRIPTION_PLAN,
  //   action: ACTIONS.UPDATE,
  // })
  // @Patch(':id')
  // updatePlan(
  //   @Param('id', ParseObjectIdPipe) id: string,
  //   @Body() dto: UpdateSubscriptionPlanDto,
  //   @Req() req: AuthedRequest,
  // ) {
  //   return this.subscriptionPlanService.updatePlan(
  //     id,
  //     dto,
  //     req.user.userId,
  //     req,
  //   );
  // }

  // @ApiOperation({ summary: 'Delete subscription plan (Superadmin)' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.SUBSCRIPTION_PLAN,
  //   action: ACTIONS.DELETE,
  // })
  // @Delete(':id')
  // deletePlan(
  //   @Param('id', ParseObjectIdPipe) id: string,
  //   @Req() req: AuthedRequest,
  // ) {
  //   return this.subscriptionPlanService.deletePlan(id, req.user.userId, req);
  // }

  // @ApiOperation({ summary: 'Toggle plan status (Superadmin)' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.SUBSCRIPTION_PLAN,
  //   action: ACTIONS.UPDATE,
  // })
  // @Patch(':id/toggle-status')
  // togglePlanStatus(
  //   @Param('id', ParseObjectIdPipe) id: string,
  //   @Req() req: AuthedRequest,
  // ) {
  //   return this.subscriptionPlanService.togglePlanStatus(
  //     id,
  //     req.user.userId,
  //     req,
  //   );
  // }
}
