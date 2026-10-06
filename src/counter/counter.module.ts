import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CounterController } from './counter.controller';
import { CounterService } from './counter.service';
import { CounterSchema, CounterSchemaName } from '../models/counter.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CounterSchemaName, schema: CounterSchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
  ],
  controllers: [CounterController],
  providers: [CounterService],
  exports: [CounterService],
})
export class CounterModule {}
