import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { SupplierSchema, SupplierSchemaName } from '../models/supplier.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupplierSchemaName, schema: SupplierSchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
