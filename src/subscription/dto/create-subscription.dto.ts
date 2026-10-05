import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import {
  BillingCycle,
  SubscriptionStatus,
} from '../../utils/enums/subscription.enums';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsMongoId()
  companyId: string;

  @ApiProperty()
  @IsMongoId()
  planId: string;

  @ApiProperty({ enum: SubscriptionStatus })
  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trialStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trialEndDate?: string;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}