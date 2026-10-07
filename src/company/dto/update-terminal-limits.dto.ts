import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { CompanyStatus } from '../../utils/enums/company.enums';

export class UpdateTerminalLimitsDto {
  @ApiPropertyOptional({ example: 10, description: 'Maximum allowed counter terminals/PCs' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTerminals?: number;

  @ApiPropertyOptional({ example: 10, description: 'Maximum allowed counter stations' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  allowedCountersCount?: number;

  @ApiPropertyOptional({ example: 20, description: 'Maximum allowed staff user accounts' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({ example: true, description: 'Enable multi-terminal / multi-counter POS features' })
  @IsOptional()
  @IsBoolean()
  isMultiTerminalAllowed?: boolean;

  @ApiPropertyOptional({ enum: CompanyStatus, example: CompanyStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}
