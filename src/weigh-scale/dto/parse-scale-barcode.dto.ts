import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ParseScaleBarcodeDto {
  @ApiProperty({
    description: 'Scanned barcode string from weighing scale label or barcode scanner',
    example: '2100012015003',
  })
  @IsNotEmpty()
  @IsString()
  barcode: string;
}
