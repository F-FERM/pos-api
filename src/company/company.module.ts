import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import {
  StoreLicenseSchema,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import { UserModule } from '../user/user.module';
import { LogModule } from '../log/log.module';
import { NumberSettingsModule } from '../number-settings/number-settings.module';
import { CounterModule } from '../counter/counter.module';
import { LoyaltySettingModule } from '../loyalty-setting/loyalty-setting.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanySchemaName, schema: CompanySchema },
      { name: StoreLicenseSchemaName, schema: StoreLicenseSchema },
    ]),
    forwardRef(() => UserModule),
    LogModule,
    NumberSettingsModule,
    CounterModule,
    LoyaltySettingModule,
    SubscriptionModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
