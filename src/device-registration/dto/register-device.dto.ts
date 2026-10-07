import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'LIC-SUP-98765-XYZ',
    description: 'Store License Key assigned to supermarket company',
  })
  @IsString()
  @IsNotEmpty()
  licenseKey: string;

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
