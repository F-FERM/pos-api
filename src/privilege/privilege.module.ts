import { forwardRef, Module } from '@nestjs/common';
import { PrivilegeService } from './privilege.service';
import { PrivilegeController } from './privilege.controller';
import {
  PrivilegesSchema,
  PrivilegesSchemaName,
} from '../models/privilege.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import {
  SubModuleSchema,
  SubModuleSchemaName,
} from '../models/sub-module.schema';
import { UserSchema, UserSchemaName } from '../models/user.schema';
import { LogModule } from '../log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrivilegesSchemaName, schema: PrivilegesSchema },
      { name: SubModuleSchemaName, schema: SubModuleSchema },
      { name: UserSchemaName, schema: UserSchema },
    ]),
    CompanyModule,
    forwardRef(() => UserModule),
    LogModule,
  ],
  controllers: [PrivilegeController],
  providers: [PrivilegeService],
  exports: [PrivilegeService],
})
export class PrivilegeModule {}
