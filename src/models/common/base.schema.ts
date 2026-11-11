import { Prop, Schema } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class BaseSchema {
  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isSynced?: boolean;

  @Prop({ type: Date, default: null })
  syncedAt?: Date | null;

  @Prop({ type: Number, default: 1, min: 1 })
  syncVersion?: number;

  @Prop({ type: Date, default: null })
  lastSyncedAt?: Date | null;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  createdBy: Types.ObjectId;
}

export const BaseModelConstants: { [K in keyof BaseSchema]-?: K } = {
  isDeleted: 'isDeleted',
  isSynced: 'isSynced',
  syncedAt: 'syncedAt',
  syncVersion: 'syncVersion',
  lastSyncedAt: 'lastSyncedAt',
  createdBy: 'createdBy',
};
