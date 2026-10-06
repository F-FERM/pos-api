import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenRegisterDto {
  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  openingCash: number;

  @ApiProperty()
  @IsMongoId()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
