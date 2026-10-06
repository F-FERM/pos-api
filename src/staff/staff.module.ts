import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffSchema, StaffSchemaName } from '../models/staff.schema';
import { UserSchema, UserSchemaName } from '../models/user.schema';
import {
  PrivilegesSchema,
  PrivilegesSchemaName,
} from '../models/privilege.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StaffSchemaName, schema: StaffSchema },
      { name: UserSchemaName, schema: UserSchema },
      { name: PrivilegesSchemaName, schema: PrivilegesSchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
