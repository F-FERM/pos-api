import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerSchema, CustomerSchemaName } from '../models/customer.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerSchemaName, schema: CustomerSchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
