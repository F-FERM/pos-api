import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  TransactionReferenceType,
  TransactionType,
} from '../../models/account-transaction.schema';

export class CreateAccountTransactionDto {
  @ApiProperty({ example: '65f123456789abcdef123456', description: 'Account ID to post entry' })
  @IsMongoId()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.DEBIT })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 1500.0, description: 'Transaction monetary amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    enum: TransactionReferenceType,
    example: TransactionReferenceType.MANUAL,
  })
  @IsOptional()
  @IsEnum(TransactionReferenceType)
  referenceType?: TransactionReferenceType;

  @ApiPropertyOptional({ example: 'MAN-TXN-001' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiProperty({ example: 'Manual adjustment for store bank deposit' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
