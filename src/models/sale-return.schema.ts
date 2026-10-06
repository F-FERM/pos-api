import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import { RefundMethod } from '../utils/common.enum';

export type SaleReturnDocument = SaleReturn & Document;

@Schema({ _id: false })
export class SaleReturnItem {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  })
  productId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  productName: string;

  @Prop({ type: Number, required: true, min: 0.001 })
  quantity: number;

  @Prop({ type: Number, required: true, min: 0 })
  unitPrice: number;

  @Prop({ type: Number, required: true, min: 0 })
  refundAmount: number;

  @Prop({ trim: true })
  reason?: string;
}

const SaleReturnItemSchema = SchemaFactory.createForClass(SaleReturnItem);

@Schema({ timestamps: true, collection: 'sale_returns' })
export class SaleReturn extends BaseSchema {
  @Prop({ required: true, trim: true })
  returnNumber: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
    index: true,
  })
  saleId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  invoiceNumber: string;

  @Prop({ type: [SaleReturnItemSchema], required: true })
  items: SaleReturnItem[];

  @Prop({ type: Number, required: true, min: 0 })
  subtotalRefund: number;

  @Prop({ type: Number, default: 0, min: 0 })
  taxRefund: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalRefundAmount: number;

  @Prop({
    type: String,
    enum: RefundMethod,
    required: true,
    default: RefundMethod.CASH,
  })
  refundMethod: RefundMethod;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
  })
  customerId?: Types.ObjectId | null;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegisterSession',
    default: null,
  })
  registerSessionId?: Types.ObjectId | null;

  @Prop({ trim: true })
  notes?: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;
}

export const SaleReturnSchema = SchemaFactory.createForClass(SaleReturn);
export const SaleReturnSchemaName = SaleReturn.name;

SaleReturnSchema.index({ companyId: 1, returnNumber: 1 }, { unique: true });
SaleReturnSchema.index({ companyId: 1, saleId: 1 });
SaleReturnSchema.index({ companyId: 1, createdAt: -1 });

export const SaleReturnModelConstants: { [K in keyof SaleReturn]-?: K } = {
  returnNumber: 'returnNumber',
  saleId: 'saleId',
  invoiceNumber: 'invoiceNumber',
  items: 'items',
  subtotalRefund: 'subtotalRefund',
  taxRefund: 'taxRefund',
  totalRefundAmount: 'totalRefundAmount',
  refundMethod: 'refundMethod',
  customerId: 'customerId',
  registerSessionId: 'registerSessionId',
  notes: 'notes',
  companyId: 'companyId',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
