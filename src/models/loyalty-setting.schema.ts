import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type LoyaltySettingDocument = LoyaltySetting & Document;

@Schema({ timestamps: true, collection: 'loyalty_settings' })
export class LoyaltySetting extends BaseSchema {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 100, min: 1 })
  loyaltyAmountPerPoint: number;

  @Prop({ type: Number, required: true, default: 50, min: 0 })
  minLoyaltyPointsToRedeem: number;

  @Prop({ type: Number, required: true, default: 1, min: 0 })
  loyaltyPointMonetaryValue: number;

  @Prop({ type: Boolean, default: true })
  isEnabled: boolean;
}

export const LoyaltySettingSchema =
  SchemaFactory.createForClass(LoyaltySetting);
export const LoyaltySettingSchemaName = LoyaltySetting.name;

export const LoyaltySettingModelConstants: {
  [K in keyof LoyaltySetting]-?: K;
} = {
  companyId: 'companyId',
  loyaltyAmountPerPoint: 'loyaltyAmountPerPoint',
  minLoyaltyPointsToRedeem: 'minLoyaltyPointsToRedeem',
  loyaltyPointMonetaryValue: 'loyaltyPointMonetaryValue',
  isEnabled: 'isEnabled',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
