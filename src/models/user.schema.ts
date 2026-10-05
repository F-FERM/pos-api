import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import { PrivilegesSchemaName } from './privilege.schema';

export type UserDocument = User & Document;
@Schema({ timestamps: true })
export class User extends BaseSchema {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop()
  name: string;

  @Prop({ unique: true, sparse: true, trim: true })
  email: string;

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
  companyId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt: Date;

  @Prop({ default: false })
  isSystemGenerated: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
export const UserSchemaName = User.name;

export const UserModelConstants: { [K in keyof User]: K } = {
  username: 'username',
  password: 'password',
  privilegeId: 'privilegeId',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  name: 'name',
  email: 'email',
  companyId: 'companyId',
  isActive: 'isActive',
  lastLoginAt: 'lastLoginAt',
  isSystemGenerated: 'isSystemGenerated',
};
