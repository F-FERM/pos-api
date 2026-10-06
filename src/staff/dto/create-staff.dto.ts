import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({ example: 'John Cashier' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'cashier@store.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: 'Cashier',
    description:
      'Designation / Staff Role (e.g. Cashier, Salesperson, Manager, Store Keeper)',
    default: 'Cashier',
  })
  @IsString()
  @IsNotEmpty()
  designation: string;

  @ApiProperty({
    example: '1234',
    description: '4-6 digit quick login PIN / password for POS terminal login',
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  pin: string;

  @ApiProperty({ description: 'Privilege ID assigning staff permissions' })
  @IsMongoId()
  privilegeId: string;

  @ApiProperty()
  @IsMongoId()
  companyId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
