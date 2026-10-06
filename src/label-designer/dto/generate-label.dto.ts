import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class LabelItemDto {
  @ApiProperty({ description: 'Product ObjectId' })
  @IsMongoId()
  productId: string;

  @ApiProperty({
    example: 10,
    description: 'Number of sticker labels to print for this product',
  })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class GenerateLabelDto {
  @ApiProperty({ type: [LabelItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabelItemDto)
  items: LabelItemDto[];

  @ApiPropertyOptional({
    example: '50x25',
    description: 'Sticker size dimension in mm (e.g. 50x25, 38x25, 40x30)',
    default: '50x25',
  })
  @IsOptional()
  @IsString()
  labelSize?: string;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Number of sticker columns per row (e.g. 1 for single roll, 2 for 2-up, 3 for 3-up)',
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  columns?: number;
}
