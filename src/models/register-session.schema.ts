import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type RegisterSessionDocument = RegisterSession & Document;

export enum RegisterSessionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Schema({ timestamps: true, collection: 'register_sessions' })
export class RegisterSession extends BaseSchema {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  openingCash: number;

  @Prop({ type: Number, default: 0 })
  closingCash?: number;

  @Prop({ type: Number, default: 0 })
  totalSalesCash: number;

  @Prop({ type: Number, default: 0 })
  totalSalesCard: number;

  @Prop({ type: Number, default: 0 })
  totalSalesOther: number;

  @Prop({
    type: String,
    enum: RegisterSessionStatus,
    default: RegisterSessionStatus.OPEN,
  })
  status: RegisterSessionStatus;

  @Prop({ type: Date, default: Date.now })
  openedAt: Date;

  @Prop({ type: Date, default: null })
  closedAt?: Date | null;

  @Prop({ trim: true })
  notes?: string;
}

export const RegisterSessionSchema =
  SchemaFactory.createForClass(RegisterSession);
export const RegisterSessionSchemaName = RegisterSession.name;

RegisterSessionSchema.index({ companyId: 1, userId: 1, status: 1 });

export const RegisterSessionModelConstants: {
  [K in keyof RegisterSession]-?: K;
} = {
  userId: 'userId',
  companyId: 'companyId',
  openingCash: 'openingCash',
  closingCash: 'closingCash',
  totalSalesCash: 'totalSalesCash',
  totalSalesCard: 'totalSalesCard',
  totalSalesOther: 'totalSalesOther',
  status: 'status',
  openedAt: 'openedAt',
  closedAt: 'closedAt',
  notes: 'notes',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
