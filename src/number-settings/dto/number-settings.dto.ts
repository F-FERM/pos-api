import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { numberSettingsDocumentType } from '../../utils/common.enum';

export class UpdateNumberSettingDto {
  @ApiProperty({ enum: numberSettingsDocumentType })
  @IsEnum(numberSettingsDocumentType)
  docType: numberSettingsDocumentType;

  @ApiPropertyOptional({ example: 'INV-' })
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  nextNumber?: number;

  @ApiPropertyOptional({ enum: ['Auto', 'Manual'], default: 'Auto' })
  @IsOptional()
  @IsString()
  mode?: 'Auto' | 'Manual';
}
