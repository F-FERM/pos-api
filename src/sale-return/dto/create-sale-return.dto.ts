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
import { RefundMethod } from '../../utils/common.enum';

export class CreateSaleReturnItemDto {
  @ApiProperty({ description: 'Product ID being returned' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: 1, description: 'Quantity of item returned' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({
    example: 'Defective product / damaged',
    description: 'Reason for return/refund',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateSaleReturnDto {
  @ApiProperty({ description: 'Original Sale Invoice ObjectId' })
  @IsMongoId()
  saleId: string;

  @ApiProperty({ type: [CreateSaleReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleReturnItemDto)
  items: CreateSaleReturnItemDto[];

  @ApiProperty({ enum: RefundMethod, default: RefundMethod.CASH })
  @IsEnum(RefundMethod)
  refundMethod: RefundMethod;

  @ApiPropertyOptional({ description: 'Active POS cash register session ID' })
  @IsOptional()
  @IsMongoId()
  registerSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
