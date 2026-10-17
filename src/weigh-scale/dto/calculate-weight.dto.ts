import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CalculateWeightDto {
  @ApiProperty({
    description: 'Product ID being weighed',
    example: '65f987654321abcdef654321',
  })
  @IsNotEmpty()
  @IsMongoId()
  productId: string;

  @ApiProperty({
    description: 'Gross weight read from scale in kg',
    example: 1.55,
  })
  @IsNumber()
  @Min(0)
  grossWeight: number;

  @ApiPropertyOptional({
    description: 'Optional tare weight override in kg (e.g. 0.05 kg for container)',
    example: 0.05,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tareWeightOverride?: number;
}
