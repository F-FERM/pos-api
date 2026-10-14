import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConvertToPaidDto {
  @ApiProperty({ example: 12, description: 'Subscription validity in months (e.g. 1, 3, 6, 12, 24)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  validityMonths: number;

  @ApiPropertyOptional({ example: 'Professional Plan', default: 'Professional Plan' })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiPropertyOptional({ example: 5, description: 'Max allowed active users' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({ example: 3, description: 'Max allowed active terminal counters' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCounters?: number;

  @ApiPropertyOptional({ example: 'Converted store trial to paid 1-year subscription' })
  @IsOptional()
  @IsString()
  reason?: string;
}
