import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UnitController } from './unit.controller';
import { UnitService } from './unit.service';
import { UnitSchema, UnitSchemaName } from '../models/unit.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UnitSchemaName, schema: UnitSchema }]),
    LogModule,
    forwardRef(() => CompanyModule),
    forwardRef(() => UserModule),
    SyncModule,
  ],
  controllers: [UnitController],
  providers: [UnitService],
  exports: [UnitService],
})
export class UnitModule {}
