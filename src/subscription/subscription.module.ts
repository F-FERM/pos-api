import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import {
  SubscriptionSchema,
  SubscriptionSchemaName,
} from '../models/subscription.schema';
import { UserModule } from '../user/user.module';
import { CompanyModule } from '../company/company.module';
import { LogModule } from '../log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubscriptionSchemaName, schema: SubscriptionSchema },
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => CompanyModule),
    LogModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
