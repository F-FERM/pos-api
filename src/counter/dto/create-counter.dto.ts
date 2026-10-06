import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateCounterDto {
  @ApiProperty({
    description: 'Name of the checkout counter / register station',
    example: 'Counter 1',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    description: 'Counter code / identifier',
    example: 'CNT-01',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  code: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Set as default counter for the store/company',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
