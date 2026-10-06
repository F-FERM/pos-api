import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { SaleReturnService } from './sale-return.service';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Sale Return')
@Controller('sale-return')
export class SaleReturnController {
  constructor(private readonly saleReturnService: SaleReturnService) {}

  @ApiOperation({
    summary:
      'Process POS sale return & refund (restocks inventory, adjusts customer loyalty/ledger)',
  })
  @CheckPermission({
    subModule: SUB_MODULES.SALE_RETURN,
    action: ACTIONS.CREATE,
  })
  @Post()
  create(@Body() dto: CreateSaleReturnDto, @Req() req: AuthedRequest) {
    return this.saleReturnService.createSaleReturn(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all processed sale returns & refunds' })
  @CheckPermission({
    subModule: SUB_MODULES.SALE_RETURN,
    action: ACTIONS.READ,
  })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.saleReturnService.findAllSaleReturns(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
    );
  }

  @ApiOperation({ summary: 'Get sale return details by ID' })
  @CheckPermission({
    subModule: SUB_MODULES.SALE_RETURN,
    action: ACTIONS.READ,
  })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.saleReturnService.findOneSaleReturn(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }
}
