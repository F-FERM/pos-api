import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyDeviceDto {
  @ApiProperty({
    example: 'WIN-DESK-GUID-998877',
    description: 'Hardware MAC/UUID or GUID fingerprint of physical counter PC',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiPropertyOptional({
    example: 'LIC-SUP-98765-XYZ',
    description: 'Store License Key',
  })
  @IsOptional()
  @IsString()
  licenseKey?: string;

  @ApiPropertyOptional({
    description: 'Saved Device Token from local storage',
  })
  @IsOptional()
  @IsString()
  deviceToken?: string;
}
