import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class RegisterDeviceDto {
  @ApiPropertyOptional({
    example: 'LIC-SUP-98765-XYZ',
    description: 'Store License Key assigned to supermarket company',
  })
  @IsOptional()
  @IsString()
  licenseKey?: string;

  @ApiPropertyOptional({
    example: 'owner_username',
    description: 'Store owner username for credential fallback',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    example: 'owner@supermarket.com',
    description: 'Owner email address associated with the store license',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'OwnerPassword123!',
    description: 'Owner password for credential fallback',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({
    example: 'WIN-DESK-GUID-998877',
    description: 'Hardware MAC/UUID or GUID fingerprint of physical counter PC',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({
    example: 'Counter 1 Windows POS Terminal',
    description: 'Friendly terminal machine display name',
  })
  @IsString()
  @IsNotEmpty()
  deviceName: string;

  @ApiPropertyOptional({
    example: '65f123456789abcdef123456',
    description: 'Counter ID to bind this physical machine to',
  })
  @IsOptional()
  @IsMongoId()
  counterId?: string;
}
