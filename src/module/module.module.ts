import { Module } from '@nestjs/common';
import { ModuleService } from './module.service';
import { ModuleController } from './module.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ModuleSchema, ModuleSchemaName } from '../models/module.schema';
import { CompanyModule } from '../company/company.module';
import {
  SubModuleSchema,
  SubModuleSchemaName,
} from '../models/sub-module.schema';
import { SubModuleController } from './sub-module.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModuleSchemaName, schema: ModuleSchema },
      { name: SubModuleSchemaName, schema: SubModuleSchema },
    ]),
    CompanyModule,
  ],
  controllers: [ModuleController, SubModuleController],
  providers: [ModuleService],
  exports: [ModuleService],
})
export class ModuleModule {}
