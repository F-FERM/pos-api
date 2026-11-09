import { Module } from '@nestjs/common';
import { PaymentTermsService } from './payment-terms.service';
import { PaymentTermsController } from './payment-terms.controller';
import { CompanyModule } from 'src/company/company.module';
import { UserModule } from 'src/user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PaymentTermSchema,
  PaymentTermSchemaName,
} from 'src/models/payment-terms.schema';
import { LogModule } from 'src/log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentTermSchemaName, schema: PaymentTermSchema },
    ]),
    UserModule,
    CompanyModule,
    LogModule,
  ],
  controllers: [PaymentTermsController],
  providers: [PaymentTermsService],
  exports: [PaymentTermsService],
})
export class PaymentTermsModule {}
