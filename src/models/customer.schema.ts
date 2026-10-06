import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true, collection: 'customers' })
export class Customer extends BaseSchema {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  creditLimit: number;

  @Prop({ type: Number, default: 0 })
  balanceDue: number;

  @Prop({ type: Number, default: 0, min: 0 })
  loyaltyPoints: number;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
export const CustomerSchemaName = Customer.name;

CustomerSchema.index({ companyId: 1, phone: 1 });
CustomerSchema.index({ companyId: 1, name: 1 });

export const CustomerModelConstants: { [K in keyof Customer]-?: K } = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  address: 'address',
  creditLimit: 'creditLimit',
  balanceDue: 'balanceDue',
  loyaltyPoints: 'loyaltyPoints',
  companyId: 'companyId',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
