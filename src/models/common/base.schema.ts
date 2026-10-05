import { Prop, Schema } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class BaseSchema {
  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  createdBy: Types.ObjectId;
}
