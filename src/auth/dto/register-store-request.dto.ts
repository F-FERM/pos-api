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

  @ApiProperty({ example: 'Store Owner Name' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  ownerName: string;

  @ApiProperty({ example: 'owner@supermarket.com' })
  @IsEmail()
  @IsNotEmpty()
  ownerEmail: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 20)
  ownerPhone: string;

  @ApiProperty({ example: 'OwnerSecret123!' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;

  @ApiProperty({ example: 'Mumbai' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ example: '400001' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'IN', default: 'IN' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}
