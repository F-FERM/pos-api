import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { BrandSchema, BrandSchemaName } from '../models/brand.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BrandSchemaName, schema: BrandSchema }]),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
