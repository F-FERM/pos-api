import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { CompanyStatus } from '../../utils/enums/company.enums';

export class UpdateCounterLimitsDto {
  @ApiPropertyOptional({ example: 10, description: 'Maximum allowed checkout counters' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCounters?: number;

  @ApiPropertyOptional({ example: 20, description: 'Maximum allowed staff user accounts' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({ example: true, description: 'Enable multi-counter POS features' })
  @IsOptional()
  @IsBoolean()
  isMultiCounterAllowed?: boolean;

  @ApiPropertyOptional({ enum: CompanyStatus, example: CompanyStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}
