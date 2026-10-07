import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { DeviceRegistrationController } from './device-registration.controller';
import { DeviceRegistrationService } from './device-registration.service';
import {
  DeviceRegistrationSchema,
  DeviceRegistrationSchemaName,
} from '../models/device-registration.schema';
import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import {
  StoreLicenseSchema,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import { JWT_CONSTANTS } from '../auth/jwt.constants';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeviceRegistrationSchemaName, schema: DeviceRegistrationSchema },
      { name: CompanySchemaName, schema: CompanySchema },
      { name: StoreLicenseSchemaName, schema: StoreLicenseSchema },
    ]),
    JwtModule.register({
      secret: JWT_CONSTANTS.secret,
      signOptions: { expiresIn: '365d' },
    }),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [DeviceRegistrationController],
  providers: [DeviceRegistrationService],
  exports: [DeviceRegistrationService],
})
export class DeviceRegistrationModule {}
