import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ default: 'CASH' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expenseDate?: string;
}
