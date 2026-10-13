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

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  createdBy: Types.ObjectId;
}
