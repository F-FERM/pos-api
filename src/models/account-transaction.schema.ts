import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type AccountTransactionDocument = AccountTransaction & Document;

export enum TransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum TransactionReferenceType {
  SALE = 'SALE',
  SALE_RETURN = 'SALE_RETURN',
  PURCHASE = 'PURCHASE',
  EXPENSE = 'EXPENSE',
  MANUAL = 'MANUAL',
}

@Schema({ timestamps: true, collection: 'account_transactions' })
export class AccountTransaction extends BaseSchema {
  @Prop({ required: true, trim: true, uppercase: true })
  transactionNumber: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true,
  })
  accountId: Types.ObjectId;

  @Prop({
    type: String,
    enum: TransactionType,
    required: true,
  })
  type: TransactionType;

  @Prop({ type: Number, required: true, min: 0.01 })
  amount: number;

  @Prop({ type: Number, required: true })
  balanceAfter: number;

  @Prop({
    type: String,
    enum: TransactionReferenceType,
    required: true,
    default: TransactionReferenceType.MANUAL,
  })
  referenceType: TransactionReferenceType;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  })
  referenceId?: Types.ObjectId | null;

  @Prop({ trim: true })
  referenceNumber?: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: Date, default: Date.now })
  transactionDate: Date;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;
}

export const AccountTransactionSchema =
  SchemaFactory.createForClass(AccountTransaction);
export const AccountTransactionSchemaName = AccountTransaction.name;

AccountTransactionSchema.index({ companyId: 1, accountId: 1, transactionDate: -1 });
AccountTransactionSchema.index({ companyId: 1, transactionNumber: 1 });

export const AccountTransactionModelConstants: {
  [K in keyof AccountTransaction]-?: K;
} = {
  transactionNumber: 'transactionNumber',
  accountId: 'accountId',
  type: 'type',
  amount: 'amount',
  balanceAfter: 'balanceAfter',
  referenceType: 'referenceType',
  referenceId: 'referenceId',
  referenceNumber: 'referenceNumber',
  description: 'description',
  transactionDate: 'transactionDate',
  companyId: 'companyId',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
