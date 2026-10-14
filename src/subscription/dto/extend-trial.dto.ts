import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ExtendTrialDto {
  @ApiProperty({
    example: 30,
    description: 'Number of trial extension days (e.g. 7, 14, 30, 60, 90)',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  additionalDays: number;

  @ApiPropertyOptional({
    example: 'Store owner requested 30 days trial extension for evaluation',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
