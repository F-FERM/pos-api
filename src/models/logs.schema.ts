import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import { LogStatus } from '../utils/common.enum';
export type LogsModelDocument = LogsModel & Document;

@Schema({ timestamps: true })
export class LogsModel extends BaseSchema {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  })
  companyId: Types.ObjectId | null;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  entityId: Types.ObjectId;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  path: string;

  @Prop({ required: false, type: Date, default: new Date() })
  date: Date;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  additionalData?: Record<string, any>;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({
    type: String,
    enum: LogStatus,
    default: LogStatus.SUCCESS,
  })
  status: LogStatus;
}

export const LogsModelSchema = SchemaFactory.createForClass(LogsModel);
export const LogsModelSchemaName = LogsModel.name;

export const LogsModelModelConstants: { [K in keyof LogsModel]: K } = {
  companyId: 'companyId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  description: 'description',
  path: 'path',
  date: 'date',
  additionalData: 'additionalData',
  ipAddress: 'ipAddress',
  status: 'status',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
