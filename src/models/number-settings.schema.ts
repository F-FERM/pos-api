import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { numberSettingsDocumentType } from '../utils/common.enum';
import { BaseSchema } from './common/base.schema';

export type NumberSettingDocument = NumberSetting & Document;

@Schema({ timestamps: true, collection: 'number_settings' })
export class NumberSetting extends BaseSchema {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(numberSettingsDocumentType),
    required: true,
  })
  docType: numberSettingsDocumentType;

  @Prop({ type: String, default: 'DOC-', trim: true })
  prefix: string;

  @Prop({ type: Number, default: 1 })
  nextNumber: number;

  @Prop({ type: String, default: '00001' })
  nextNumberRaw: string;
}

export const NumberSettingSchema = SchemaFactory.createForClass(NumberSetting);
export const NumberSettingSchemaName = NumberSetting.name;

NumberSettingSchema.index({ companyId: 1, docType: 1 }, { unique: true });

export const NumberSettingModelConstants: {
  [K in keyof NumberSetting]-?: K;
} = {
  companyId: 'companyId',
  docType: 'docType',
  prefix: 'prefix',
  nextNumber: 'nextNumber',
  nextNumberRaw: 'nextNumberRaw',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
