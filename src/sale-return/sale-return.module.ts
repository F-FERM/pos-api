import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SaleReturnController } from './sale-return.controller';
import { SaleReturnService } from './sale-return.service';
import {
  SaleReturnSchema,
  SaleReturnSchemaName,
} from '../models/sale-return.schema';
import { SaleSchema, SaleSchemaName } from '../models/sale.schema';
import { ProductSchema, ProductSchemaName } from '../models/product.schema';
import { CustomerSchema, CustomerSchemaName } from '../models/customer.schema';
import {
  RegisterSessionSchema,
  RegisterSessionSchemaName,
} from '../models/register-session.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import { NumberSettingsModule } from '../number-settings/number-settings.module';
import { LoyaltySettingModule } from '../loyalty-setting/loyalty-setting.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SaleReturnSchemaName, schema: SaleReturnSchema },
      { name: SaleSchemaName, schema: SaleSchema },
      { name: ProductSchemaName, schema: ProductSchema },
      { name: CustomerSchemaName, schema: CustomerSchema },
      { name: RegisterSessionSchemaName, schema: RegisterSessionSchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
    NumberSettingsModule,
    LoyaltySettingModule,
  ],
  controllers: [SaleReturnController],
  providers: [SaleReturnService],
  exports: [SaleReturnService],
})
export class SaleReturnModule {}
