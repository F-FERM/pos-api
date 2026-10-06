import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LabelDesignerController } from './label-designer.controller';
import { LabelDesignerService } from './label-designer.service';
import { ProductSchema, ProductSchemaName } from '../models/product.schema';
import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductSchemaName, schema: ProductSchema },
      { name: CompanySchemaName, schema: CompanySchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [LabelDesignerController],
  providers: [LabelDesignerService],
  exports: [LabelDesignerService],
})
export class LabelDesignerModule {}
