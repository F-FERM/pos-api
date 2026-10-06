import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type SupplierDocument = Supplier & Document;

@Schema({ timestamps: true, collection: 'suppliers' })
export class Supplier extends BaseSchema {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  contactPerson?: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true, uppercase: true })
  taxId?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ type: Number, default: 0 })
  balanceDue: number;

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

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
export const SupplierSchemaName = Supplier.name;

SupplierSchema.index({ companyId: 1, phone: 1 });
SupplierSchema.index({ companyId: 1, name: 1 });

export const SupplierModelConstants: { [K in keyof Supplier]-?: K } = {
  name: 'name',
  contactPerson: 'contactPerson',
  phone: 'phone',
  email: 'email',
  taxId: 'taxId',
  address: 'address',
  balanceDue: 'balanceDue',
  companyId: 'companyId',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
