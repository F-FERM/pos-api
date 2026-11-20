import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateSubCategoryDto {
  @ApiProperty({ description: 'Sub category name', example: 'Wheat Flour' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Sub category code',
    example: 'SUB-FLOUR-01',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Sub category description',
    example: 'All types of wheat flour',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Main Category ID',
    example: '65f987654321abcdef654321',
  })
  @IsNotEmpty()
  @IsMongoId()
  categoryId: string;

  @ApiPropertyOptional({ default: true, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
