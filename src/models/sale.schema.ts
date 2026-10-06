import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type SaleDocument = Sale & Document;

//TODO: update sale status enum's
export enum SaleStatus {
  COMPLETED = 'COMPLETED',
  PARKED = 'PARKED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  CREDIT = 'CREDIT',
  SPLIT = 'SPLIT',
}

@Schema({ _id: false })
export class SaleItem {
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

  @Prop({ type: Number, default: 0, min: 0 })
  discountAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  taxRate: number;

  @Prop({ type: Number, default: 0, min: 0 })
  taxAmount: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalAmount: number;
}

const SaleItemSchema = SchemaFactory.createForClass(SaleItem);

@Schema({ timestamps: true, collection: 'sales' })
export class Sale extends BaseSchema {
  @Prop({ required: true, trim: true })
  invoiceNumber: string;

  @Prop({ type: [SaleItemSchema], required: true })
  items: SaleItem[];

  @Prop({ type: Number, required: true, min: 0 })
  subtotal: number;

  @Prop({ type: Number, default: 0, min: 0 })
  discountTotal: number;

  @Prop({ type: Number, default: 0, min: 0 })
  taxTotal: number;

  @Prop({ type: Number, required: true, min: 0 })
  grandTotal: number;

  @Prop({ type: Number, required: true, min: 0 })
  paidAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  changeAmount: number;

  @Prop({
    type: String,
    enum: PaymentMethod,
    required: true,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

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

  @Prop({
    type: String,
    enum: SaleStatus,
    required: true,
    default: SaleStatus.COMPLETED,
  })
  status: SaleStatus;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({ trim: true })
  notes?: string;
}

export const SaleSchema = SchemaFactory.createForClass(Sale);
export const SaleSchemaName = Sale.name;

SaleSchema.index({ companyId: 1, invoiceNumber: 1 }, { unique: true });
SaleSchema.index({ companyId: 1, createdAt: -1 });
SaleSchema.index({ companyId: 1, status: 1 });

export const SaleModelConstants: { [K in keyof Sale]-?: K } = {
  invoiceNumber: 'invoiceNumber',
  items: 'items',
  subtotal: 'subtotal',
  discountTotal: 'discountTotal',
  taxTotal: 'taxTotal',
  grandTotal: 'grandTotal',
  paidAmount: 'paidAmount',
  changeAmount: 'changeAmount',
  paymentMethod: 'paymentMethod',
  customerId: 'customerId',
  registerSessionId: 'registerSessionId',
  status: 'status',
  companyId: 'companyId',
  notes: 'notes',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
