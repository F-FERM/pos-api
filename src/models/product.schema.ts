import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema, BaseModelConstants } from './common/base.schema';

export type ProductDocument = Product & Document;

/* ====================== TAB 1: BASIC INFO ====================== */
@Schema({ _id: false })
export class BasicInfo {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  image?: string;

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
    ref: 'Unit',
    required: true,
    index: true,
  })
  unitId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null,
  })
  supplierId?: Types.ObjectId | null;
}
export const BasicInfoSchema = SchemaFactory.createForClass(BasicInfo);

/* ====================== TAB 2: PRICING & TAX ====================== */
@Schema({ _id: false })
export class PricingAndTax {
  @Prop({ type: Number, default: 0, min: 0 })
  purchasePrice: number;

  @Prop({ type: Number, required: true, min: 0 })
  sellingPrice: number;

  @Prop({ type: Number, default: 0, min: 0 })
  vatRate: number;

  @Prop({ type: Number, default: 0 })
  profitMargin: number;

  @Prop({ type: Number, default: 0, min: 0 })
  sellingPriceBeforeVat: number;

  @Prop({ type: Number, default: 0, min: 0 })
  vatAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  priceIncludingVat: number;
}
export const PricingAndTaxSchema = SchemaFactory.createForClass(PricingAndTax);

/* ====================== TAB 3: INVENTORY MANAGEMENT ====================== */
@Schema({ _id: false })
export class InventoryManagement {
  @Prop({ type: Boolean, default: true })
  enableStockTracking: boolean;

  @Prop({ type: Number, default: 0 })
  openingStock: number;

  @Prop({ type: Number, default: 10, min: 0 })
  lowStockAlert: number;

  @Prop({ trim: true, default: '' })
  description?: string;
}
export const InventoryManagementSchema =
  SchemaFactory.createForClass(InventoryManagement);

/* ====================== MAIN PRODUCT SCHEMA ====================== */
@Schema({
  timestamps: true,
  collection: 'products',
})
export class Product extends BaseSchema {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  @Prop({ type: BasicInfoSchema, required: true })
  basicInfo: BasicInfo;

  @Prop({ type: PricingAndTaxSchema, required: true })
  pricingAndTax: PricingAndTax;

  @Prop({ type: InventoryManagementSchema, required: true })
  inventoryManagement: InventoryManagement;

  /* Weigh Scale Attributes */
  @Prop({ type: Boolean, default: false })
  isWeighted: boolean;

  @Prop({ trim: true, index: true })
  scalePlu?: string;

  @Prop({ default: 'KG', trim: true })
  scaleUnit?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  tareWeight?: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
export const ProductSchemaName = Product.name;

/* Indexes */
ProductSchema.index({ companyId: 1, 'basicInfo.barcode': 1 }, { sparse: true });
ProductSchema.index({ companyId: 1, 'basicInfo.sku': 1 }, { sparse: true });
ProductSchema.index({ companyId: 1, scalePlu: 1 }, { sparse: true });
ProductSchema.index({ companyId: 1, 'basicInfo.name': 1 });
ProductSchema.index({ companyId: 1, 'basicInfo.categoryId': 1 });

export const ProductModelConstants = {
  ...BaseModelConstants,
  companyId: 'companyId',
  basicInfo: 'basicInfo',
  pricingAndTax: 'pricingAndTax',
  inventoryManagement: 'inventoryManagement',
  isWeighted: 'isWeighted',
  scalePlu: 'scalePlu',
  scaleUnit: 'scaleUnit',
  tareWeight: 'tareWeight',
  isActive: 'isActive',

  // Convenience property paths
  name: 'basicInfo.name',
  sku: 'basicInfo.sku',
  barcode: 'basicInfo.barcode',
  categoryId: 'basicInfo.categoryId',
  brandId: 'basicInfo.brandId',
  unitId: 'basicInfo.unitId',
  supplierId: 'basicInfo.supplierId',
  image: 'basicInfo.image',
  unitOfMeasure: 'scaleUnit',

  purchasePrice: 'pricingAndTax.purchasePrice',
  sellingPrice: 'pricingAndTax.sellingPrice',
  vatRate: 'pricingAndTax.vatRate',
  profitMargin: 'pricingAndTax.profitMargin',
  sellingPriceBeforeVat: 'pricingAndTax.sellingPriceBeforeVat',
  vatAmount: 'pricingAndTax.vatAmount',
  priceIncludingVat: 'pricingAndTax.priceIncludingVat',

  enableStockTracking: 'inventoryManagement.enableStockTracking',
  openingStock: 'inventoryManagement.openingStock',
  lowStockAlert: 'inventoryManagement.lowStockAlert',
  description: 'inventoryManagement.description',
} as const;
