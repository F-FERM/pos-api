import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import { PaperWidth } from '../utils/common.enum';

export type PrinterDocument = Printer & Document;

@Schema({ timestamps: true, collection: 'printers' })
export class Printer extends BaseSchema {
  @Prop({ required: true, trim: true })
  printerName: string;

  @Prop({ required: true, trim: true })
  printerIp: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    default: null,
    index: true,
  })
  counterId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(PaperWidth),
    default: PaperWidth.MM_80,
  })
  paperWidth: PaperWidth;

  @Prop({ type: Boolean, default: false, index: true })
  isDefault: boolean;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;
}

export const PrinterSchema = SchemaFactory.createForClass(Printer);
export const PrinterSchemaName = Printer.name;

PrinterSchema.index({ companyId: 1, printerName: 1 }, { unique: true });
PrinterSchema.index({ companyId: 1, counterId: 1 });
PrinterSchema.index({ companyId: 1, isDefault: 1 });

export const PrinterModelConstants: { [K in keyof Printer]-?: K } = {
  printerName: 'printerName',
  printerIp: 'printerIp',
  counterId: 'counterId',
  paperWidth: 'paperWidth',
  isDefault: 'isDefault',
  isActive: 'isActive',
  companyId: 'companyId',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
