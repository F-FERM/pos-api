import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type DeviceRegistrationDocument = DeviceRegistration & Document;

export enum DeviceStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

@Schema({ timestamps: true, collection: 'device_registrations' })
export class DeviceRegistration extends BaseSchema {
  @Prop({ required: true, trim: true, index: true })
  deviceId: string;

  @Prop({ required: true, trim: true })
  deviceName: string;

  @Prop({ required: true, trim: true, uppercase: true })
  licenseKey: string;

  @Prop({ required: true, trim: true })
  deviceToken: string;

  @Prop({
    type: String,
    enum: DeviceStatus,
    default: DeviceStatus.ACTIVE,
  })
  status: DeviceStatus;

  @Prop({ type: Boolean, default: true })
  isBypassedInhouse: boolean;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    default: null,
  })
  counterId?: Types.ObjectId | null;

  @Prop({ trim: true })
  ipAddress?: string;

  @Prop({ type: Date, default: Date.now })
  lastPingAt: Date;
}

export const DeviceRegistrationSchema =
  SchemaFactory.createForClass(DeviceRegistration);
export const DeviceRegistrationSchemaName = DeviceRegistration.name;

DeviceRegistrationSchema.index({ companyId: 1, deviceId: 1 }, { unique: true });
DeviceRegistrationSchema.index({ licenseKey: 1 });

export const DeviceRegistrationModelConstants: {
  [K in keyof DeviceRegistration]-?: K;
} = {
  deviceId: 'deviceId',
  deviceName: 'deviceName',
  licenseKey: 'licenseKey',
  deviceToken: 'deviceToken',
  status: 'status',
  isBypassedInhouse: 'isBypassedInhouse',
  companyId: 'companyId',
  counterId: 'counterId',
  ipAddress: 'ipAddress',
  lastPingAt: 'lastPingAt',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
