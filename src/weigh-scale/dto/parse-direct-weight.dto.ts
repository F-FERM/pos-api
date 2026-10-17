import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ParseDirectWeightDto {
  @ApiProperty({
    description: 'Raw ASCII string read from USB/Serial COM port scale (e.g., ST,GS,+001.500kg)',
    example: 'ST,GS,+001.500kg',
  })
  @IsNotEmpty()
  @IsString()
  rawData: string;

  @ApiPropertyOptional({
    description: 'Product ID to automatically calculate selling subtotal for this weight',
    example: '65f987654321abcdef654321',
  })
  @IsOptional()
  @IsMongoId()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Scale protocol identifier (CAS, NCI, TOLEDO, DIBAL, GENERIC)',
    example: 'CAS',
  })
  @IsOptional()
  @IsString()
  protocol?: string;
}
