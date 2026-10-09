import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class VerifyOtpRequestDto {
  @ApiProperty({ example: 'owner@supermarket.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit email OTP code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp: string;

  @ApiPropertyOptional({
    example: 'WIN-DESK-GUID-998877',
    description: 'Hardware MAC/UUID or GUID fingerprint of physical counter PC',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'Counter 1 Windows POS Terminal',
    description: 'Friendly terminal machine display name',
  })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({
    example: '65f123456789abcdef123456',
    description: 'Counter ID to bind physical machine to during verification',
  })
  @IsOptional()
  @IsMongoId()
  counterId?: string;
}
