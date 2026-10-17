import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum ScaleBarcodeType {
  WEIGHT_EMBEDDED = 'WEIGHT_EMBEDDED',
  PRICE_EMBEDDED = 'PRICE_EMBEDDED',
}

export class UpdateWeighScaleSettingsDto {
  @ApiPropertyOptional({
    description: 'Master toggle to enable/disable weigh scale barcode parsing',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: '2-digit standard prefix for scale-printed barcodes (20-29)',
    example: '21',
  })
  @IsOptional()
  @IsString()
  barcodePrefix?: string;

  @ApiPropertyOptional({
    enum: ScaleBarcodeType,
    description: 'Whether scale barcode embeds weight in grams or total price in cents',
    example: ScaleBarcodeType.WEIGHT_EMBEDDED,
  })
  @IsOptional()
  @IsEnum(ScaleBarcodeType)
  barcodeType?: ScaleBarcodeType;

  @ApiPropertyOptional({
    description: 'Number of digits used for product PLU code in barcode (4 or 5)',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @IsIn([4, 5])
  pluLength?: number;

  @ApiPropertyOptional({
    description: 'Weight multiplier to convert scale raw integer digits to kilograms',
    example: 0.001,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightMultiplier?: number;

  @ApiPropertyOptional({
    description: 'Direct checkout scale USB/Serial COM protocol (CAS, NCI, TOLEDO, DIBAL)',
    example: 'CAS',
  })
  @IsOptional()
  @IsString()
  directScaleProtocol?: string;

  @ApiPropertyOptional({
    description: 'Serial COM port baud rate for direct checkout scale',
    example: 9600,
  })
  @IsOptional()
  @IsNumber()
  @Min(1200)
  @Max(115200)
  baudRate?: number;
}
