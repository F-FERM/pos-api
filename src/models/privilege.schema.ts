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

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    default: [],
  })
  modules: Types.ObjectId[];

  @Prop({
    type: [
      {
        subModuleId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SubModule',
        },
        canCreate: { type: Boolean, default: false },
        canRead: { type: Boolean, default: false },
        canUpdate: { type: Boolean, default: false },
        canDelete: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  subModulePermissions: {
    subModuleId: Types.ObjectId;
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  }[];
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
  modules: 'modules',
  subModulePermissions: 'subModulePermissions',
};
