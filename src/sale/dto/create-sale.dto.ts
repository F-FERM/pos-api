import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod, SaleStatus } from '../../models/sale.schema';

export class CreateSaleItemDto {
  @ApiProperty()
  @IsMongoId()
  productId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class CreateSaleDto {
  @ApiProperty({ type: [CreateSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  paidAmount: number;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Number of customer loyalty points to redeem for a discount',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  redeemLoyaltyPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  registerSessionId?: string;

  @ApiPropertyOptional({
    description: 'Counter ID of the checkout station making the sale',
    example: '65f123456789abcdef123456',
  })
  @IsOptional()
  @IsMongoId()
  counterId?: string;

  @ApiPropertyOptional({ enum: SaleStatus, default: SaleStatus.COMPLETED })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @ApiProperty()
  @IsMongoId()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
