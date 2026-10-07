import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type StoreLicenseDocument = StoreLicense & Document;

export enum LicenseStatus {
  UNASSIGNED = 'UNASSIGNED',
  ASSIGNED = 'ASSIGNED',
  TRIAL = 'TRIAL',
  REDEEMED = 'REDEEMED',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
}

@Schema({ timestamps: true, collection: 'store_licenses' })
export class StoreLicense extends BaseSchema {
  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  })
  licenseKey: string;

  @Prop({ trim: true, lowercase: true, index: true })
  assignedEmail?: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true,
  })
  companyId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: LicenseStatus,
    default: LicenseStatus.UNASSIGNED,
    index: true,
  })
  status: LicenseStatus;

  @Prop({ type: Boolean, default: false })
  isTrial: boolean;

  @Prop({ type: Number, default: 5, min: 1 })
  maxCounters: number;

  @Prop({ type: Number, default: 10, min: 1 })
  maxUsers: number;

  @Prop({ type: Number, default: 12, min: 1 })
  validityMonths: number;

  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  redeemedAt?: Date | null;

  @Prop({ trim: true })
  notes?: string;
}

export const StoreLicenseSchema = SchemaFactory.createForClass(StoreLicense);
export const StoreLicenseSchemaName = StoreLicense.name;

export const StoreLicenseModelConstants: {
  [K in keyof StoreLicense]-?: K;
} = {
  licenseKey: 'licenseKey',
  assignedEmail: 'assignedEmail',
  companyId: 'companyId',
  status: 'status',
  isTrial: 'isTrial',
  maxCounters: 'maxCounters',
  maxUsers: 'maxUsers',
  validityMonths: 'validityMonths',
  expiresAt: 'expiresAt',
  redeemedAt: 'redeemedAt',
  notes: 'notes',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
