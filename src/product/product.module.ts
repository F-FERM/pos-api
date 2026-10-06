import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductSchema, ProductSchemaName } from '../models/product.schema';
import { CategoryModule } from '../category/category.module';
import { BrandModule } from '../brand/brand.module';
import { SupplierModule } from '../supplier/supplier.module';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductSchemaName, schema: ProductSchema },
    ]),
    CategoryModule,
    BrandModule,
    SupplierModule,
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
