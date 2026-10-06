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
import { type AuthedRequest } from '../utils/common.types';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlanController {
  constructor(
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

  //TODO:add proper authorization guards for superadmin routes
  @ApiOperation({ summary: 'Get all active subscription plans' })
  @Get()
  getAllActivePlans() {
    return this.subscriptionPlanService.getAllActivePlans();
  }

  @ApiOperation({ summary: 'Get all subscription plans (Superadmin)' })
  @Get('all')
  getAllPlans(@Req() req: AuthedRequest) {
    return this.subscriptionPlanService.getAllPlans(req.user.userId);
  }

  @ApiOperation({ summary: 'Get subscription plan by id' })
  @Get(':id')
  getPlanById(@Param('id', ParseObjectIdPipe) id: string) {
    return this.subscriptionPlanService.getPlanById(id);
  }

  @ApiOperation({ summary: 'Get subscription plan by code' })
  @Get('code/:code')
  getPlanByCode(@Param('code') code: string) {
    return this.subscriptionPlanService.getPlanByCode(code);
  }

  @ApiOperation({ summary: 'Create subscription plan (Superadmin)' })
  @Post()
  createCustomPlan(
    @Body() dto: CreateSubscriptionPlanDto,
    @Req() req: AuthedRequest,
  ) {
    return this.subscriptionPlanService.createCustomPlan(
      dto,
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Update subscription plan (Superadmin)' })
  @Patch(':id')
  updatePlan(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
    @Req() req: AuthedRequest,
  ) {
    return this.subscriptionPlanService.updatePlan(
      id,
      dto,
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete subscription plan (Superadmin)' })
  @Delete(':id')
  deletePlan(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.subscriptionPlanService.deletePlan(id, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Toggle plan status (Superadmin)' })
  @Patch(':id/toggle-status')
  togglePlanStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.subscriptionPlanService.togglePlanStatus(
      id,
      req.user.userId,
      req,
    );
  }
}
