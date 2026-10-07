import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoyaltySettingController } from './loyalty-setting.controller';
import { LoyaltySettingService } from './loyalty-setting.service';
import {
  LoyaltySettingSchema,
  LoyaltySettingSchemaName,
} from '../models/loyalty-setting.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LoyaltySettingSchemaName, schema: LoyaltySettingSchema },
    ]),
    LogModule,
    forwardRef(() => CompanyModule),
    forwardRef(() => UserModule),
  ],
  controllers: [LoyaltySettingController],
  providers: [LoyaltySettingService],
  exports: [LoyaltySettingService],
})
export class LoyaltySettingModule {}
