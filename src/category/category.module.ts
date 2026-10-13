import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CategorySchema, CategorySchemaName } from '../models/category.schema';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';

import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CategorySchemaName, schema: CategorySchema },
    ]),
    LogModule,
    CompanyModule,
    UserModule,
    SyncModule,
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
