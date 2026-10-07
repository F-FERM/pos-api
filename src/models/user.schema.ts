import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import { PrivilegesSchemaName } from './privilege.schema';

export type UserDocument = User & Document;
@Schema({ timestamps: true })
export class User extends BaseSchema {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ trim: true })
  name: string;

  @Prop({ unique: true, sparse: true, trim: true, lowercase: true })
  email: string;

  @Prop({ trim: true, sparse: true })
  phone?: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: PrivilegesSchemaName,
    required: true,
  })
  privilegeId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  })
  companyId?: Types.ObjectId | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt: Date;

  @Prop({ default: false })
  isSystemGenerated: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
export const UserSchemaName = User.name;

export const UserModelConstants: { [K in keyof Required<User>]: K } = {
  username: 'username',
  password: 'password',
  privilegeId: 'privilegeId',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  name: 'name',
  email: 'email',
  phone: 'phone',
  companyId: 'companyId',
  isActive: 'isActive',
  lastLoginAt: 'lastLoginAt',
  isSystemGenerated: 'isSystemGenerated',
};
