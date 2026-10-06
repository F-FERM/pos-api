import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type PurchaseDocument = Purchase & Document;

@Schema({ _id: false })
export class PurchaseItem {
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
  costPrice: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalCost: number;
}

const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);

@Schema({ timestamps: true, collection: 'purchases' })
export class Purchase extends BaseSchema {
  @Prop({ required: true, trim: true })
  billNumber: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
  })
  supplierId: Types.ObjectId;

  @Prop({ type: [PurchaseItemSchema], required: true })
  items: PurchaseItem[];

  @Prop({ type: Number, required: true, min: 0 })
  totalAmount: number;

  @Prop({ type: Number, required: true, min: 0 })
  paidAmount: number;

  @Prop({ type: Number, required: true, min: 0 })
  dueAmount: number;

  @Prop({ type: Date, default: Date.now })
  purchaseDate: Date;

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

export const PurchaseSchema = SchemaFactory.createForClass(Purchase);
export const PurchaseSchemaName = Purchase.name;

PurchaseSchema.index({ companyId: 1, billNumber: 1 });
PurchaseSchema.index({ companyId: 1, purchaseDate: -1 });

export const PurchaseModelConstants: { [K in keyof Purchase]-?: K } = {
  billNumber: 'billNumber',
  supplierId: 'supplierId',
  items: 'items',
  totalAmount: 'totalAmount',
  paidAmount: 'paidAmount',
  dueAmount: 'dueAmount',
  purchaseDate: 'purchaseDate',
  companyId: 'companyId',
  notes: 'notes',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
