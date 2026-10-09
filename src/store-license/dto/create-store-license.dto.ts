import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LicenseStatus } from '../../models/store-license.schema';

export class CreateStoreLicenseDto {
  @ApiPropertyOptional({
    example: 'LIC-SUP-998877-XYZ',
    description: 'Custom license key string (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  licenseKey?: string;

  @ApiPropertyOptional({
    example: 'owner@supermarket.com',
    description: 'Target email address pre-assigned to this license key',
  })
  @IsOptional()
  @IsEmail()
  assignedEmail?: string;

  @ApiPropertyOptional({
    example: 5,
    default: 5,
    description: 'Maximum checkout counters allowed under this license key',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCounters?: number;

  @ApiPropertyOptional({
    example: 10,
    default: 10,
    description: 'Maximum staff user accounts allowed under this license key',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({
    example: 12,
    default: 12,
    description: 'Validity duration in months',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  validityMonths?: number;

  @ApiPropertyOptional({
    enum: LicenseStatus,
    default: LicenseStatus.UNASSIGNED,
  })
  @IsOptional()
  @IsEnum(LicenseStatus)
  status?: LicenseStatus;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this store license is in trial mode',
  })
  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Custom expiration date for the license',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Internal notes or customer order ref' })
  @IsOptional()
  @IsString()
  notes?: string;
}
