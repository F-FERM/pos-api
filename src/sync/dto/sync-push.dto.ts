import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';

export class SyncPushDto {
  @ApiPropertyOptional({ type: [Object], description: 'Array of company model updates' })
  @IsOptional()
  @IsArray()
  companies?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of user model updates' })
  @IsOptional()
  @IsArray()
  users?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of product model updates' })
  @IsOptional()
  @IsArray()
  products?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of customer model updates' })
  @IsOptional()
  @IsArray()
  customers?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of supplier model updates' })
  @IsOptional()
  @IsArray()
  suppliers?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of sale invoice updates' })
  @IsOptional()
  @IsArray()
  sales?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of sale return updates' })
  @IsOptional()
  @IsArray()
  saleReturns?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of purchase bill updates' })
  @IsOptional()
  @IsArray()
  purchases?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of expense updates' })
  @IsOptional()
  @IsArray()
  expenses?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of chart of account updates' })
  @IsOptional()
  @IsArray()
  accounts?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of account transaction ledger updates' })
  @IsOptional()
  @IsArray()
  accountTransactions?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of register shift session updates' })
  @IsOptional()
  @IsArray()
  registerSessions?: Record<string, any>[];

  @ApiPropertyOptional({ type: [Object], description: 'Array of terminal device registration updates' })
  @IsOptional()
  @IsArray()
  deviceRegistrations?: Record<string, any>[];
}
