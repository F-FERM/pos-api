import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { AccountCategory, AccountType } from '../../models/account.schema';

export class CreateAccountDto {
  @ApiProperty({ example: '1030', description: 'Unique chart of account numeric/alpha code' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  code: string;

  @ApiProperty({ example: 'Petty Cash', description: 'Friendly account title' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.ASSET })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ enum: AccountCategory, example: AccountCategory.CURRENT_ASSET })
  @IsOptional()
  @IsEnum(AccountCategory)
  category?: AccountCategory;

  @ApiPropertyOptional({ example: 0, description: 'Initial opening balance' })
  @IsOptional()
  @IsNumber()
  balance?: number;

  @ApiPropertyOptional({ example: 'Petty cash drawer for small daily incidentals' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
