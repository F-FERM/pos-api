import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/* ====================== TAB 1: BASIC INFO DTO ====================== */
export class BasicInfoDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Fortune Sunflower Oil 1L',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Alias name',
    example: 'Fortune Oil 1L',
  })
  @IsOptional()
  @IsString()
  aliasName?: string;

  @ApiPropertyOptional({
    description: 'Product image URL or path',
    example: 'https://example.com/images/oil.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'Stock Keeping Unit / Product Code',
    example: 'PRD-001',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Product barcode string for scanner checkout',
    example: '8901234567890',
  })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({
    description: 'Category ID',
    example: '65f987654321abcdef654321',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Sub Category ID',
    example: '65f987654321abcdef654325',
  })
  @IsOptional()
  @IsMongoId()
  subCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Brand ID',
    example: '65f987654321abcdef654323',
  })
  @IsOptional()
  @IsMongoId()
  brandId?: string;

  @ApiProperty({
    description: 'Unit ID',
    example: '65f987654321abcdef654322',
  })
  @IsNotEmpty()
  @IsMongoId()
  unitId: string;

  @ApiPropertyOptional({
    description: 'Supplier ID',
    example: '65f987654321abcdef654324',
  })
  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Product description or details',
    example: 'Enter product description..',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/* ====================== TAB 2: PRICING & TAX DTO ====================== */
export class PricingAndTaxDto {
  @ApiPropertyOptional({
    default: 0,
    description: 'Purchase price / cost price',
    example: 8.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiProperty({
    description: 'Selling price per unit',
    example: 10.0,
  })
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'VAT percentage rate',
    example: 5.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'MRP (Maximum Retail Price)',
    example: 12.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Profit margin percentage',
    example: 15.0,
  })
  @IsOptional()
  @IsNumber()
  profitMargin?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Selling price before VAT',
    example: 10.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPriceBeforeVat?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'VAT amount in currency',
    example: 0.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatAmount?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Price including VAT',
    example: 10.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceIncludingVat?: number;
}

/* ====================== TAB 3: INVENTORY MANAGEMENT DTO ====================== */
export class InventoryManagementDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Enable stock tracking',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enableStockTracking?: boolean;

  @ApiPropertyOptional({
    default: 0,
    description: 'Opening stock quantity',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  openingStock?: number;

  @ApiPropertyOptional({
    default: 10,
    description: 'Low stock alert threshold',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockAlert?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Reorder quantity',
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderQuantity?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Allow selling when out of stock',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  allowSellingWhenOutOfStock?: boolean;

  @ApiPropertyOptional({
    description: 'Product description or details',
    example: 'Enter product details...',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/* ====================== TAB 4: EXPIRY TRACKING DTO ====================== */
export class BatchItemDto {
  @ApiPropertyOptional({
    description: 'Batch or Lot Number',
    example: '500ml',
  })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional({
    description: 'Expiry date ISO string',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: Date;

  @ApiPropertyOptional({
    default: 0,
    description: 'Quantity for this batch',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  batchQty?: number;
}

export class ExpiryTrackingDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Enable expiry date tracking',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  enableExpiryTracking?: boolean;

  @ApiPropertyOptional({
    type: [BatchItemDto],
    description: 'List of product batch/lot items',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchItemDto)
  batches?: BatchItemDto[];

  @ApiPropertyOptional({
    default: '15 Days',
    description: 'Expiry alert threshold before date',
    example: '15 Days',
  })
  @IsOptional()
  @IsString()
  expiryAlertBefore?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Block sales of expired products',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  blockExpiredSales?: boolean;
}

/* ====================== TAB 5: ADVANCED INFO DTO ====================== */
export class AdvancedInfoDto {
  @ApiPropertyOptional({
    description: 'Serial Number / IMEI',
    example: 'SN123456789',
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    default: 'No Warranty',
    description: 'Warranty period',
    example: 'No Warranty',
  })
  @IsOptional()
  @IsString()
  warrantyPeriod?: string;

  @ApiPropertyOptional({
    default: '7 Days',
    description: 'Return period',
    example: '7 Days',
  })
  @IsOptional()
  @IsString()
  returnPeriod?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Available at POS billing',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  availableAtPos?: boolean;

  @ApiPropertyOptional({
    description: 'Internal notes or remarks',
    example: 'Fragile item, handle with care',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;
}

/* ====================== MAIN CREATE PRODUCT DTO ====================== */
export class CreateProductDto {
  @ApiProperty({
    type: () => BasicInfoDto,
    description: 'Basic product info',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BasicInfoDto)
  basicInfo: BasicInfoDto;

  @ApiProperty({
    type: () => PricingAndTaxDto,
    description: 'Pricing & tax info',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PricingAndTaxDto)
  pricingAndTax: PricingAndTaxDto;

  @ApiProperty({
    type: () => InventoryManagementDto,
    description: 'Inventory management settings',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => InventoryManagementDto)
  inventoryManagement: InventoryManagementDto;

  @ApiPropertyOptional({
    type: () => ExpiryTrackingDto,
    description: 'Expiry tracking configuration and batches',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpiryTrackingDto)
  expiryTracking?: ExpiryTrackingDto;

  @ApiPropertyOptional({
    type: () => AdvancedInfoDto,
    description: 'Advanced product options',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdvancedInfoDto)
  advancedInfo?: AdvancedInfoDto;

  /* Weigh Scale Attributes */
  @ApiPropertyOptional({
    default: false,
    description: 'Flag indicating item is sold by weight / volume on scale',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isWeighted?: boolean;

  @ApiPropertyOptional({
    description:
      'Short Price Look-Up (PLU) code mapped on weighing scale machine',
    example: '00012',
  })
  @IsOptional()
  @IsString()
  scalePlu?: string;

  @ApiPropertyOptional({
    default: 'KG',
    description: 'Weighing scale measurement unit (KG, G, LB, OZ)',
    example: 'KG',
  })
  @IsOptional()
  @IsString()
  scaleUnit?: string;

  @ApiPropertyOptional({
    default: 0,
    description: 'Tare weight in kg to automatically deduct for packaging/box',
    example: 0.05,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tareWeight?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Active product available for billing',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
