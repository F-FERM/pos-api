import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeighScaleController } from './weigh-scale.controller';
import { WeighScaleService } from './weigh-scale.service';
import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import { ProductSchema, ProductSchemaName } from '../models/product.schema';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import { LogModule } from '../log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanySchemaName, schema: CompanySchema },
      { name: ProductSchemaName, schema: ProductSchema },
    ]),
    forwardRef(() => CompanyModule),
    forwardRef(() => UserModule),
    LogModule,
  ],
  controllers: [WeighScaleController],
  providers: [WeighScaleService],
  exports: [WeighScaleService],
})
export class WeighScaleModule {}
