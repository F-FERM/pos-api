import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserSchema, UserSchemaName } from '../models/user.schema';
import {
  PrivilegesSchema,
  PrivilegesSchemaName,
} from '../models/privilege.schema';
import { CompanyModule } from '../company/company.module';
import { LogModule } from '../log/log.module';

import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import {
  StoreLicenseSchema,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';

import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSchemaName, schema: UserSchema },
      { name: PrivilegesSchemaName, schema: PrivilegesSchema },
      { name: CompanySchemaName, schema: CompanySchema },
      { name: StoreLicenseSchemaName, schema: StoreLicenseSchema },
    ]),
    MongooseModule.forFeature(
      [
        { name: UserSchemaName, schema: UserSchema },
        { name: PrivilegesSchemaName, schema: PrivilegesSchema },
      ],
      'cloudConnection',
    ),
    forwardRef(() => CompanyModule),
    LogModule,
    forwardRef(() => SyncModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
