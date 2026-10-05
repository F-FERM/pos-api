import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';

class SubModulePermissionDto {
  @ApiProperty()
  @IsMongoId()
  subModuleId: string;

  @ApiProperty()
  @IsBoolean()
  canCreate: boolean;

  @ApiProperty()
  @IsBoolean()
  canRead: boolean;

  @ApiProperty()
  @IsBoolean()
  canUpdate: boolean;

  @ApiProperty()
  @IsBoolean()
  canDelete: boolean;
}

export class CreatePrivilegesDto {
  @ApiProperty({ example: 'Sales Executive' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  modules: string[];

  @ApiProperty({ type: [SubModulePermissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubModulePermissionDto)
  permissions: SubModulePermissionDto[];
}

export class UpdatePrivilegesDto extends CreatePrivilegesDto {}
