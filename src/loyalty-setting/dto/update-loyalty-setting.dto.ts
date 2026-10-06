import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateLoyaltySettingDto {
  @ApiPropertyOptional({
    example: 100,
    default: 100,
    description: 'Amount spent in rupees/currency to earn 1 loyalty point',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  loyaltyAmountPerPoint?: number;

  @ApiPropertyOptional({
    example: 50,
    default: 50,
    description:
      'Minimum loyalty points required in customer balance before redemption is allowed',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minLoyaltyPointsToRedeem?: number;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description:
      'Monetary discount value in rupees per 1 redeemed loyalty point (e.g. 1 point = ₹1)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyPointMonetaryValue?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Enable or disable the store customer loyalty program',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
