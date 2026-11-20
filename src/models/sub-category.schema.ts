import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema, BaseModelConstants } from './common/base.schema';

export type SubCategoryDocument = SubCategory & Document;

@Schema({ timestamps: true, collection: 'sub_categories' })
export class SubCategory extends BaseSchema {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  code?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  categoryId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const SubCategorySchema = SchemaFactory.createForClass(SubCategory);
export const SubCategorySchemaName = SubCategory.name;

SubCategorySchema.index({ companyId: 1, categoryId: 1, name: 1 }, { unique: true });

export const SubCategoryModelConstants: { [K in keyof SubCategory]-?: K } = {
  ...BaseModelConstants,
  name: 'name',
  code: 'code',
  description: 'description',
  categoryId: 'categoryId',
  companyId: 'companyId',
  isActive: 'isActive',
};
