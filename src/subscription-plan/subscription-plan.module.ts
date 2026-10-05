import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionPlanService } from './subscription-plan.service';
import { SubscriptionPlanController } from './subscription-plan.controller';
import {
  SubscriptionPlanSchema,
  SubscriptionPlanSchemaName,
} from '../models/subscription-plan.schema';
import { LogModule } from '../log/log.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubscriptionPlanSchemaName, schema: SubscriptionPlanSchema },
    ]),
    LogModule,
    UserModule,
  ],
  controllers: [SubscriptionPlanController],
  providers: [SubscriptionPlanService],
  exports: [SubscriptionPlanService],
})
export class SubscriptionPlanModule {}
