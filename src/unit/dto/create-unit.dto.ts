import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ description: 'Unit name (e.g. Kilogram, Piece)', example: 'Kilogram' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Unit symbol (e.g. kg, pcs)', example: 'kg' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiProperty({ description: 'Company Store ID', example: '650000000000000000000001' })
  @IsNotEmpty()
  @IsMongoId()
  companyId: string;

  @ApiPropertyOptional({ description: 'Active status', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
