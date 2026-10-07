import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SubscriptionStatus } from '../../utils/enums/subscription.enums';

export class UpdateSubscriptionStatusAndDateDto {
  @ApiPropertyOptional({
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
    description: 'Updated store subscription status (ACTIVE, SUSPENDED, CANCELLED, EXPIRED, TRIAL)',
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    example: '2027-12-31T23:59:59.000Z',
    description: 'Explicit new end/expiry date for store subscription',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Updated maximum allowed checkout counters',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCounters?: number;

  @ApiPropertyOptional({
    example: 25,
    description: 'Updated maximum allowed staff users',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({
    description: 'Internal admin notes or reason for subscription change',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
