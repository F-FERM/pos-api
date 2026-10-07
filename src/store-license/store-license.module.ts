import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreLicenseController } from './store-license.controller';
import { StoreLicenseService } from './store-license.service';
import {
  StoreLicenseSchema,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import { LogModule } from '../log/log.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoreLicenseSchemaName, schema: StoreLicenseSchema },
    ]),
    LogModule,
    UserModule,
  ],
  controllers: [StoreLicenseController],
  providers: [StoreLicenseService],
  exports: [StoreLicenseService, MongooseModule],
})
export class StoreLicenseModule {}
