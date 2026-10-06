import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PaperWidth } from '../../utils/common.enum';

export class CreatePrinterDto {
  @ApiProperty({
    description: 'Name of the thermal printer',
    example: 'Counter 1 Thermal Printer',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  printerName: string;

  @ApiProperty({
    description:
      'Printer IP address (e.g. 192.168.1.100) or Windows USB spooler name',
    example: '192.168.1.100',
  })
  @IsString()
  @IsNotEmpty()
  printerIp: string;

  @ApiPropertyOptional({
    description: 'Counter ID bound to this printer',
    example: '65f123456789abcdef123456',
  })
  @IsOptional()
  @IsMongoId()
  counterId?: string;

  @ApiPropertyOptional({
    enum: PaperWidth,
    default: PaperWidth.MM_80,
    description: 'Thermal receipt paper width: 58mm or 80mm',
    example: PaperWidth.MM_80,
  })
  @IsOptional()
  @IsEnum(PaperWidth)
  paperWidth?: PaperWidth;

  @ApiPropertyOptional({
    default: false,
    description: 'Set as default printer for the store/company',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty()
  @IsMongoId()
  companyId: string;
}
