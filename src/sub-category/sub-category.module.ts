import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubCategoryController } from './sub-category.controller';
import { SubCategoryService } from './sub-category.service';
import {
  SubCategorySchema,
  SubCategorySchemaName,
} from '../models/sub-category.schema';
import { CategoryModule } from '../category/category.module';
import { LogModule } from '../log/log.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubCategorySchemaName, schema: SubCategorySchema },
    ]),
    CategoryModule,
    LogModule,
    CompanyModule,
    UserModule,
    SyncModule,
  ],
  controllers: [SubCategoryController],
  providers: [SubCategoryService],
  exports: [SubCategoryService],
})
export class SubCategoryModule {}
