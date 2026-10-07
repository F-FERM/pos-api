import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type EmailOtpDocument = EmailOtp & Document;

@Schema({ timestamps: true, collection: 'email_otps' })
export class EmailOtp extends BaseSchema {
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, trim: true })
  otp: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: Object, default: {} })
  registrationPayload: Record<string, any>;
}

export const EmailOtpSchema = SchemaFactory.createForClass(EmailOtp);
export const EmailOtpSchemaName = EmailOtp.name;

EmailOtpSchema.index({ email: 1, otp: 1 });
EmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailOtpModelConstants: { [K in keyof EmailOtp]-?: K } = {
  email: 'email',
  otp: 'otp',
  expiresAt: 'expiresAt',
  isVerified: 'isVerified',
  registrationPayload: 'registrationPayload',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
