import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NumberSettingsController } from './number-settings.controller';
import { NumberSettingsService } from './number-settings.service';
import {
  NumberSettingSchema,
  NumberSettingSchemaName,
} from '../models/number-settings.schema';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import { LogModule } from '../log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NumberSettingSchemaName, schema: NumberSettingSchema },
    ]),
    forwardRef(() => CompanyModule),
    forwardRef(() => UserModule),
    LogModule,
  ],
  controllers: [NumberSettingsController],
  providers: [NumberSettingsService],
  exports: [NumberSettingsService],
})
export class NumberSettingsModule {}
