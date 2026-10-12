import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CounterController } from './counter.controller';
import { CounterService } from './counter.service';
import { CounterSchema, CounterSchemaName } from '../models/counter.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

import { CompanySchema, CompanySchemaName } from '../models/company.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CounterSchemaName, schema: CounterSchema },
      { name: CompanySchemaName, schema: CompanySchema },
    ]),
    LogModule,
    forwardRef(() => CompanyModule),
    forwardRef(() => UserModule),
  ],
  controllers: [CounterController],
  providers: [CounterService],
  exports: [CounterService],
})
export class CounterModule {}
