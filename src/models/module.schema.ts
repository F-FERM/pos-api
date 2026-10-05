import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type ModuleDocument = Module & Document;

@Schema({ timestamps: true })
export class Module extends BaseSchema {
  @Prop({ required: true, unique: true })
  identity: string;

  @Prop({ required: true }) //display for users
  label: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isSystemGenerated: boolean;
}

export const ModuleSchema = SchemaFactory.createForClass(Module);
export const ModuleSchemaName = Module.name;

// module model constants
export const ModuleModelConstants: { [K in keyof Module]: K } = {
  identity: 'identity',
  label: 'label',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  isSystemGenerated: 'isSystemGenerated',
};
