import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseRegisterDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  closingCash: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
