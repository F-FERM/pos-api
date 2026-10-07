import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RegisterStoreRequestDto {
  @ApiProperty({ example: 'My Supermarket Store' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  companyName: string;

  @ApiProperty({
    example: 'anees_owner',
    description: 'Unique login username for owner user account',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  username: string;

  @ApiProperty({ example: 'Store Owner Name' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  ownerName: string;

  @ApiProperty({ example: 'owner@supermarket.com' })
  @IsEmail()
  @IsNotEmpty()
  ownerEmail: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Store owner contact phone number',
  })
  @IsString()
  @IsNotEmpty()
  @Length(5, 20)
  ownerPhone: string;

  @ApiProperty({ example: 'OwnerSecret123!' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;

  @ApiProperty({ example: 'Calicut' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Kerala' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ example: '673001' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'IN', default: 'IN' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}
