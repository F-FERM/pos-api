import { Module } from '@nestjs/common';
import { LogService } from './log.service';
import { LogController } from './log.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { LogsModelSchema, LogsModelSchemaName } from '../models/logs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LogsModelSchemaName, schema: LogsModelSchema },
    ]),
  ],
  controllers: [LogController],
  providers: [LogService],
  exports: [LogService],
})
export class LogModule {}
