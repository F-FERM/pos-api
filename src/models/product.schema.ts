import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true, collection: 'products' })
export class Product extends BaseSchema {
  /* ====================== MANDATORY FIELDS ====================== */

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  sellingPrice: number;

  /* ====================== OPTIONAL MINIMAL FIELDS ====================== */

  @Prop({ trim: true })
  sku?: string;

  @Prop({ trim: true, index: true })
  barcode?: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
    index: true,
  })
  categoryId?: Types.ObjectId | null;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    default: null,
  })
  brandId?: Types.ObjectId | null;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null,
  })
  supplierId?: Types.ObjectId | null;

  @Prop({ default: 'PCS', trim: true })
  unitOfMeasure: string;

  @Prop({ type: Number, default: 0, min: 0 })
  costPrice: number;

  @Prop({ type: Number, min: 0 })
  mrp?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  taxRate: number;

  @Prop({ type: Boolean, default: true })
  isTaxInclusive: boolean;

  /* Stock & Perishable Controls */
  @Prop({ type: Number, default: 0 })
  stockQuantity: number;

  @Prop({ type: Number, default: 5, min: 0 })
  minStockAlert: number;

  @Prop({ type: Boolean, default: false })
  hasBatchExpiry: boolean;

  /* Universal Attributes (Apparel / Spare Parts / General) */
  @Prop({ trim: true })
  partNumber?: string;

  @Prop({ trim: true })
  size?: string;

  @Prop({ trim: true })
  color?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
export const ProductSchemaName = Product.name;

ProductSchema.index({ companyId: 1, barcode: 1 }, { sparse: true });
ProductSchema.index({ companyId: 1, sku: 1 }, { sparse: true });
ProductSchema.index({ companyId: 1, name: 1 });
ProductSchema.index({ companyId: 1, categoryId: 1 });

export const ProductModelConstants: { [K in keyof Product]-?: K } = {
  name: 'name',
  companyId: 'companyId',
  sellingPrice: 'sellingPrice',
  sku: 'sku',
  barcode: 'barcode',
  categoryId: 'categoryId',
  brandId: 'brandId',
  supplierId: 'supplierId',
  unitOfMeasure: 'unitOfMeasure',
  costPrice: 'costPrice',
  mrp: 'mrp',
  taxRate: 'taxRate',
  isTaxInclusive: 'isTaxInclusive',
  stockQuantity: 'stockQuantity',
  minStockAlert: 'minStockAlert',
  hasBatchExpiry: 'hasBatchExpiry',
  partNumber: 'partNumber',
  size: 'size',
  color: 'color',
  description: 'description',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
