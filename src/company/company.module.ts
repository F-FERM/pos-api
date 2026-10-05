import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import { UserModule } from '../user/user.module';
import { LogModule } from '../log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanySchemaName, schema: CompanySchema },
    ]),
    forwardRef(() => UserModule),
    LogModule,
    UserModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
