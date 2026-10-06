import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { SaleReturnService } from './sale-return.service';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { UpdateSaleReturnDto } from './dto/update-sale-return.dto';
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

  @ApiOperation({
    summary:
      'Update sale return details / returned quantities (recalculates inventory stock and refunds)',
  })
  @CheckPermission({
    subModule: SUB_MODULES.SALE_RETURN,
    action: ACTIONS.UPDATE,
  })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSaleReturnDto,
    @Req() req: AuthedRequest,
  ) {
    return this.saleReturnService.updateSaleReturn(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({
    summary:
      'Cancel/Delete sale return (reverses stock restock and restores loyalty points)',
  })
  @CheckPermission({
    subModule: SUB_MODULES.SALE_RETURN,
    action: ACTIONS.DELETE,
  })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.saleReturnService.deleteSaleReturn(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
