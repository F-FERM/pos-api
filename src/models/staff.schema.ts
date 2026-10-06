import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type StaffDocument = Staff & Document;

@Schema({ timestamps: true, collection: 'staff' })
export class Staff extends BaseSchema {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ required: true, trim: true, default: 'Cashier' })
  designation: string;

  @Prop({ required: true, trim: true })
  pin: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Privileges',
    required: true,
    index: true,
  })
  privilegeId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;
}

export const StaffSchema = SchemaFactory.createForClass(Staff);
export const StaffSchemaName = Staff.name;

StaffSchema.index({ companyId: 1, phone: 1 }, { unique: true });
StaffSchema.index({ companyId: 1, pin: 1 });

export const StaffModelConstants: { [K in keyof Staff]-?: K } = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  designation: 'designation',
  pin: 'pin',
  userId: 'userId',
  privilegeId: 'privilegeId',
  companyId: 'companyId',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
