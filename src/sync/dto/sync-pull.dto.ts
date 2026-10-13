import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class SyncPullDto {
  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'ISO timestamp of last successful sync to query delta updates modified after this time',
  })
  @IsOptional()
  @IsDateString()
  lastSyncedAt?: string;
}
