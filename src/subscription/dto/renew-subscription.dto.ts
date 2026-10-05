import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { BillingCycle } from '../../utils/enums/subscription.enums';

export class RenewSubscriptionDto {
  @ApiProperty({ description: 'New start date of the renewed period' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'New end date of the renewed period' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;
}
