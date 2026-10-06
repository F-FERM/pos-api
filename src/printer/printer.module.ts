import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrinterController } from './printer.controller';
import { PrinterService } from './printer.service';
import { PrinterSchema, PrinterSchemaName } from '../models/printer.schema';
import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrinterSchemaName, schema: PrinterSchema },
      { name: CompanySchemaName, schema: CompanySchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [PrinterController],
  providers: [PrinterService],
  exports: [PrinterService],
})
export class PrinterModule {}
