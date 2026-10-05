import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import { Role } from '../utils/role.enum';

export type PrivilegesDocument = Privileges & Document;

@Schema({ timestamps: true })
export class Privileges extends BaseSchema {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ type: Array, default: [], enum: Role })
  roles: Role[];

  @Prop({ default: false })
  isSystemGenerated: boolean;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
  })
  companyId: Types.ObjectId;
}

export const PrivilegesSchema = SchemaFactory.createForClass(Privileges);
export const PrivilegesSchemaName = Privileges.name;

// privileges model constants field names
export const PrivilegesModelConstants: { [K in keyof Privileges]: K } = {
  name: 'name',
  description: 'description',
  roles: 'roles',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  isSystemGenerated: 'isSystemGenerated',
  companyId: 'companyId',
};
