import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';
import { PurchaseSchema, PurchaseSchemaName } from '../models/purchase.schema';
import { ProductSchema, ProductSchemaName } from '../models/product.schema';
import { SupplierSchema, SupplierSchemaName } from '../models/supplier.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PurchaseSchemaName, schema: PurchaseSchema },
      { name: ProductSchemaName, schema: ProductSchema },
      { name: SupplierSchemaName, schema: SupplierSchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [PurchaseController],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
