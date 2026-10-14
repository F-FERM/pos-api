import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type UnitDocument = Unit & Document;

@Schema({ timestamps: true })
export class Unit extends BaseSchema {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: false, trim: true })
  symbol?: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isSystemGenerated?: boolean;
}

export const UnitSchema = SchemaFactory.createForClass(Unit);
export const UnitSchemaName = Unit.name;

UnitSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const UnitModelConstants: { [K in keyof Unit]: K } = {
  name: 'name',
  symbol: 'symbol',
  companyId: 'companyId',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  isSynced: 'isSynced',
  syncedAt: 'syncedAt',
  isSystemGenerated: 'isSystemGenerated',
};
