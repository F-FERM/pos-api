import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type SubModuleDocument = SubModule & Document;

@Schema({ timestamps: true })
export class SubModule extends BaseSchema {
  @Prop({ required: true })
  identity: string; // invoice, bill

  @Prop({ required: true })
  label: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true,
  })
  moduleId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isSystemGenerated: boolean;
}

export const SubModuleSchema = SchemaFactory.createForClass(SubModule);
export const SubModuleSchemaName = SubModule.name;

export const SubModuleModelConstants: { [K in keyof SubModule]: K } = {
  identity: 'identity',
  label: 'label',
  moduleId: 'moduleId',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  isSystemGenerated: 'isSystemGenerated',
};
