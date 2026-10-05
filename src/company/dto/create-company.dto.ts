import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  CompanyBusinessType,
  CompanyIndustry,
} from '../../utils/enums/company.enums';

export class CompanyAddressDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  line1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  line2?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  city: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  state: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  postalCode: string;

  @ApiProperty({ example: 'IN' })
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country: string;
}

export class CompanyContactDto {
  @ApiProperty()
  @IsEmail()
  primaryEmail: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(5, 20)
  primaryPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(5, 20)
  alternatePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;
}

export class CompanyTaxIdentifiersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  vatNumber?: string;
}

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  legalName?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9-]+$/)
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/)
  slug: string;

  @ApiProperty({ enum: CompanyIndustry })
  @IsEnum(CompanyIndustry)
  industry: CompanyIndustry;

  @ApiProperty({ enum: CompanyBusinessType })
  @IsEnum(CompanyBusinessType)
  businessType: CompanyBusinessType;

  @ApiProperty({ type: CompanyContactDto })
  @ValidateNested()
  @Type(() => CompanyContactDto)
  contact: CompanyContactDto;

  @ApiProperty({ type: CompanyAddressDto })
  @ValidateNested()
  @Type(() => CompanyAddressDto)
  address: CompanyAddressDto;

  @ApiPropertyOptional({ type: CompanyTaxIdentifiersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompanyTaxIdentifiersDto)
  taxIdentifiers?: CompanyTaxIdentifiersDto;
}
