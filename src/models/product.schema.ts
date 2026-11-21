import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema, BaseModelConstants } from './common/base.schema';

export type ProductDocument = Product & Document;

/* ====================== BATCH ITEM SUB-SCHEMA ====================== */
@Schema({ _id: false })
export class BatchItem {
  @Prop({ trim: true, default: '' })
  batchNumber?: string;

  @Prop({ type: Date, default: null })
  expiryDate?: Date | null;

  @Prop({ type: Number, default: 0, min: 0 })
  batchQty?: number;
}
export const BatchItemSchema = SchemaFactory.createForClass(BatchItem);

/* ====================== TAB 1: BASIC INFO ====================== */
@Schema({ _id: false })
export class BasicInfo {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  aliasName?: string;

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
    ref: 'SubCategory',
    default: null,
    index: true,
  })
  subCategoryId?: Types.ObjectId | null;

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

  @Prop({ trim: true, default: '' })
  description?: string;
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

  @Prop({ type: Number, default: 0, min: 0 })
  mrp: number;

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

  @Prop({ type: Number, default: 0, min: 0 })
  reorderQuantity: number;

  @Prop({ type: Boolean, default: false })
  allowSellingWhenOutOfStock: boolean;

  @Prop({ trim: true, default: '' })
  description?: string;
}
export const InventoryManagementSchema =
  SchemaFactory.createForClass(InventoryManagement);

/* ====================== TAB 4: EXPIRY TRACKING ====================== */
@Schema({ _id: false })
export class ExpiryTracking {
  @Prop({ type: Boolean, default: false })
  enableExpiryTracking: boolean;

  @Prop({ type: [BatchItemSchema], default: [] })
  batches: BatchItem[];

  @Prop({ trim: true, default: '15 Days' })
  expiryAlertBefore: string;

  @Prop({ type: Boolean, default: false })
  blockExpiredSales: boolean;
}
export const ExpiryTrackingSchema =
  SchemaFactory.createForClass(ExpiryTracking);

/* ====================== TAB 5: ADVANCED INFO ====================== */
@Schema({ _id: false })
export class AdvancedInfo {
  @Prop({ trim: true, default: '' })
  serialNumber?: string;

  @Prop({ trim: true, default: 'No Warranty' })
  warrantyPeriod?: string;

  @Prop({ trim: true, default: '7 Days' })
  returnPeriod?: string;

  @Prop({ type: Boolean, default: true })
  availableAtPos: boolean;

  @Prop({ trim: true, default: '' })
  internalNotes?: string;
}
export const AdvancedInfoSchema = SchemaFactory.createForClass(AdvancedInfo);

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

  @Prop({ type: ExpiryTrackingSchema, default: () => ({}) })
  expiryTracking?: ExpiryTracking;

  @Prop({ type: AdvancedInfoSchema, default: () => ({}) })
  advancedInfo?: AdvancedInfo;

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
ProductSchema.index({ companyId: 1, 'basicInfo.subCategoryId': 1 }, { sparse: true });

export const ProductModelConstants = {
  ...BaseModelConstants,
  companyId: 'companyId',
  basicInfo: 'basicInfo',
  pricingAndTax: 'pricingAndTax',
  inventoryManagement: 'inventoryManagement',
  expiryTracking: 'expiryTracking',
  advancedInfo: 'advancedInfo',
  isWeighted: 'isWeighted',
  scalePlu: 'scalePlu',
  scaleUnit: 'scaleUnit',
  tareWeight: 'tareWeight',
  isActive: 'isActive',

  // Convenience property paths
  name: 'basicInfo.name',
  aliasName: 'basicInfo.aliasName',
  sku: 'basicInfo.sku',
  barcode: 'basicInfo.barcode',
  categoryId: 'basicInfo.categoryId',
  subCategoryId: 'basicInfo.subCategoryId',
  brandId: 'basicInfo.brandId',
  unitId: 'basicInfo.unitId',
  supplierId: 'basicInfo.supplierId',
  image: 'basicInfo.image',
  description: 'basicInfo.description',
  unitOfMeasure: 'scaleUnit',

  purchasePrice: 'pricingAndTax.purchasePrice',
  sellingPrice: 'pricingAndTax.sellingPrice',
  vatRate: 'pricingAndTax.vatRate',
  mrp: 'pricingAndTax.mrp',
  profitMargin: 'pricingAndTax.profitMargin',
  sellingPriceBeforeVat: 'pricingAndTax.sellingPriceBeforeVat',
  vatAmount: 'pricingAndTax.vatAmount',
  priceIncludingVat: 'pricingAndTax.priceIncludingVat',

  enableStockTracking: 'inventoryManagement.enableStockTracking',
  openingStock: 'inventoryManagement.openingStock',
  lowStockAlert: 'inventoryManagement.lowStockAlert',
  reorderQuantity: 'inventoryManagement.reorderQuantity',
  allowSellingWhenOutOfStock: 'inventoryManagement.allowSellingWhenOutOfStock',

  enableExpiryTracking: 'expiryTracking.enableExpiryTracking',
  batches: 'expiryTracking.batches',
  expiryAlertBefore: 'expiryTracking.expiryAlertBefore',
  blockExpiredSales: 'expiryTracking.blockExpiredSales',

  serialNumber: 'advancedInfo.serialNumber',
  warrantyPeriod: 'advancedInfo.warrantyPeriod',
  returnPeriod: 'advancedInfo.returnPeriod',
  availableAtPos: 'advancedInfo.availableAtPos',
  internalNotes: 'advancedInfo.internalNotes',
} as const;
