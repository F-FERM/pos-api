import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JWT_CONSTANTS } from './jwt.constants';
import { UserModule } from '../user/user.module';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { NumberSettingsModule } from '../number-settings/number-settings.module';
import { CounterModule } from '../counter/counter.module';
import { LoyaltySettingModule } from '../loyalty-setting/loyalty-setting.module';
import { EmailModule } from '../email/email.module';
import { ModuleSchema, ModuleSchemaName } from '../models/module.schema';
import {
  SubModuleSchema,
  SubModuleSchemaName,
} from '../models/sub-module.schema';
import { EmailOtpSchema, EmailOtpSchemaName } from '../models/email-otp.schema';
import { UserSchema, UserSchemaName } from '../models/user.schema';
import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import {
  PrivilegesSchema,
  PrivilegesSchemaName,
} from '../models/privilege.schema';
import {
  StoreLicenseSchema,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModuleSchemaName, schema: ModuleSchema },
      { name: SubModuleSchemaName, schema: SubModuleSchema },
      { name: EmailOtpSchemaName, schema: EmailOtpSchema },
      { name: UserSchemaName, schema: UserSchema },
      { name: CompanySchemaName, schema: CompanySchema },
      { name: PrivilegesSchemaName, schema: PrivilegesSchema },
      { name: StoreLicenseSchemaName, schema: StoreLicenseSchema },
    ]),
    UserModule,
    LogModule,
    CompanyModule,
    NumberSettingsModule,
    CounterModule,
    LoyaltySettingModule,
    EmailModule,
    PassportModule,
    JwtModule.register({
      secret: JWT_CONSTANTS.secret,
      signOptions: { expiresIn: '7d' }, // 7 days
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
