import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerSchema, CustomerSchemaName } from '../models/customer.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

import { SyncModule } from '../sync/sync.module';
import { SaleSchema, SaleSchemaName } from 'src/models/sale.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerSchemaName, schema: CustomerSchema },
      { name: SaleSchemaName, schema: SaleSchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
    SyncModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
