import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type ExpenseDocument = Expense & Document;

@Schema({ timestamps: true, collection: 'expenses' })
export class Expense extends BaseSchema {
  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  //TODO: Add enum for payment method
  @Prop({ required: true, default: 'CASH', trim: true })
  paymentMethod: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  referenceNo?: string;

  @Prop({ type: Date, default: Date.now })
  expenseDate: Date;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
export const ExpenseSchemaName = Expense.name;

ExpenseSchema.index({ companyId: 1, expenseDate: -1 });

export const ExpenseModelConstants: { [K in keyof Expense]-?: K } = {
  category: 'category',
  amount: 'amount',
  paymentMethod: 'paymentMethod',
  description: 'description',
  referenceNo: 'referenceNo',
  expenseDate: 'expenseDate',
  companyId: 'companyId',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
