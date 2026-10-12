import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountSchema, AccountSchemaName } from '../models/account.schema';
import {
  AccountTransactionSchema,
  AccountTransactionSchemaName,
} from '../models/account-transaction.schema';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import { LogModule } from '../log/log.module';
import { NumberSettingsModule } from '../number-settings/number-settings.module';

import { CompanySchema, CompanySchemaName } from '../models/company.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountSchemaName, schema: AccountSchema },
      { name: AccountTransactionSchemaName, schema: AccountTransactionSchema },
      { name: CompanySchemaName, schema: CompanySchema },
    ]),
    forwardRef(() => CompanyModule),
    forwardRef(() => UserModule),
    LogModule,
    NumberSettingsModule,
  ],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
