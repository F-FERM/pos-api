import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendLicenseKeyRequestDto {
  @ApiProperty({
    example: 'owner@supermarket.com',
    description: 'Registered store owner email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
