import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type AccountDocument = Account & Document;

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum AccountCategory {
  CURRENT_ASSET = 'CURRENT_ASSET',
  NON_CURRENT_ASSET = 'NON_CURRENT_ASSET',
  CURRENT_LIABILITY = 'CURRENT_LIABILITY',
  NON_CURRENT_LIABILITY = 'NON_CURRENT_LIABILITY',
  EQUITY = 'EQUITY',
  OPERATING_INCOME = 'OPERATING_INCOME',
  NON_OPERATING_INCOME = 'NON_OPERATING_INCOME',
  COST_OF_GOODS_SOLD = 'COST_OF_GOODS_SOLD',
  OPERATING_EXPENSE = 'OPERATING_EXPENSE',
  OTHER_EXPENSE = 'OTHER_EXPENSE',
}

@Schema({ timestamps: true, collection: 'accounts' })
export class Account extends BaseSchema {
  @Prop({ required: true, trim: true, uppercase: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: AccountType,
    required: true,
  })
  type: AccountType;

  @Prop({
    type: String,
    enum: AccountCategory,
    required: true,
    default: AccountCategory.OPERATING_EXPENSE,
  })
  category: AccountCategory;

  @Prop({ type: Number, required: true, default: 0 })
  balance: number;

  @Prop({ type: Boolean, default: false })
  isSystemGenerated: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
export const AccountSchemaName = Account.name;

AccountSchema.index({ companyId: 1, code: 1 }, { unique: true });
AccountSchema.index({ companyId: 1, name: 1 });
AccountSchema.index({ companyId: 1, type: 1 });

export const AccountModelConstants: { [K in keyof Account]-?: K } = {
  code: 'code',
  name: 'name',
  type: 'type',
  category: 'category',
  balance: 'balance',
  isSystemGenerated: 'isSystemGenerated',
  isActive: 'isActive',
  description: 'description',
  companyId: 'companyId',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
