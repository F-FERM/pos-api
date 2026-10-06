import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateProductDto {
  /* ====================== MANDATORY FIELDS ====================== */

  @ApiProperty({
    description:
      'Product name (Required for all business types - Supermarket, Dress Shop, Spare Parts)',
    example: 'Basmati Rice 5kg / Men Casual Shirt Blue L / Brake Pad Swift',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  name: string;

  @ApiProperty({
    description: 'Selling price per unit (Required)',
    example: 450.0,
  })
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  /* ====================== OPTIONAL MINIMAL FIELDS ====================== */

  @ApiPropertyOptional({
    description: 'Stock Keeping Unit / Product Code',
    example: 'SKU-10023',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Product barcode string for scanner checkout',
    example: '2012345678901',
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
    description: 'Brand ID',
    example: '65f987654321abcdef654323',
  })
  @IsOptional()
  @IsMongoId()
  brandId?: string;

  @ApiPropertyOptional({
    description: 'Supplier ID',
    example: '65f987654321abcdef654324',
  })
  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @ApiPropertyOptional({
    default: 'PCS',
    description: 'Unit of measure (e.g. PCS, KG, G, LTR, BOX, NOS)',
    example: 'PCS',
  })
  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @ApiPropertyOptional({
    default: 0,
    description: 'Purchase cost price per unit',
    example: 300.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({
    description:
      'Maximum Retail Price (Printed MRP for Supermarkets / Grocery)',
    example: 500.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Tax percentage rate (GST/VAT)',
    example: 5.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether selling price is inclusive of tax',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;

  @ApiPropertyOptional({
    default: 0,
    description: 'Initial stock quantity on hand',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  stockQuantity?: number;

  @ApiPropertyOptional({
    default: 5,
    description: 'Minimum stock alert threshold',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockAlert?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Perishable item flag for batch/expiry tracking (Grocery)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  hasBatchExpiry?: boolean;

  @ApiPropertyOptional({
    description: 'Part / OEM Number (For Spare Parts & Hardware stores)',
    example: 'BP-SWIFT-2020',
  })
  @IsOptional()
  @IsString()
  partNumber?: string;

  @ApiPropertyOptional({
    description: 'Size (For Dress / Apparel / Shoe shops)',
    example: 'XL / 42',
  })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({
    description: 'Color (For Dress / Apparel shops)',
    example: 'Navy Blue',
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: 'Product description or notes',
    example: 'Premium Cotton Comfort Fit Shirt',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Product active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
