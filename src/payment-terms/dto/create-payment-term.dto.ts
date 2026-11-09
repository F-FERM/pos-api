import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentTermType } from 'src/utils/common.enum';

export class CreatePaymentTermDto {
  @ApiProperty({ example: 'Net 30' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: PaymentTermType })
  @IsEnum(PaymentTermType)
  type: PaymentTermType;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  numberOfDays?: number;
}

export class UpdatePaymentTermDto extends PartialType(CreatePaymentTermDto) {}

export class BulkUpdatePaymentTermDto extends UpdatePaymentTermDto {
  @IsMongoId()
  _id: string;
}
