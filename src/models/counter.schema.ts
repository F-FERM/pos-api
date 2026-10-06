import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type CounterDocument = Counter & Document;

@Schema({ timestamps: true, collection: 'counters' })
export class Counter extends BaseSchema {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, uppercase: true })
  code: string;

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
export const CounterSchemaName = Counter.name;

CounterSchema.index({ companyId: 1, name: 1 }, { unique: true });
CounterSchema.index({ companyId: 1, code: 1 }, { unique: true });

export const CounterModelConstants: { [K in keyof Counter]-?: K } = {
  name: 'name',
  code: 'code',
  isDefault: 'isDefault',
  isActive: 'isActive',
  companyId: 'companyId',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
