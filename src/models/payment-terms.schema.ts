import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseSchema } from './common/base.schema';
import mongoose, { Document, Types } from 'mongoose';
import { PaymentTermType } from 'src/utils/common.enum';

export type PaymentTermDocument = PaymentTerm & Document;

@Schema({ timestamps: true })
export class PaymentTerm extends BaseSchema {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: PaymentTermType,
    required: false,
    default: PaymentTermType.FIXED,
  })
  type: PaymentTermType;

  @Prop({
    type: Number,
    default: null, // only for FIXED
  })
  numberOfDays: number;

  @Prop({ default: true })
  isSystemGenerated: boolean;

  @Prop({ default: true })
  isActive: boolean;
}

export const PaymentTermSchema = SchemaFactory.createForClass(PaymentTerm);

export const PaymentTermSchemaName = PaymentTerm.name;

export const PaymentTermModelConstants: { [K in keyof PaymentTerm]: K } = {
  companyId: 'companyId',
  name: 'name',
  type: 'type',
  numberOfDays: 'numberOfDays',
  isSystemGenerated: 'isSystemGenerated',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
