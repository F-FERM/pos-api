import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PaymentMethod, SaleStatus } from '../models/sale.schema';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Sale')
@Controller('sale')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @ApiOperation({ summary: 'Create new POS sale / invoice' })
  @CheckPermission({ subModule: SUB_MODULES.SALE, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateSaleDto, @Req() req: AuthedRequest) {
    return this.saleService.createSale(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all sales history' })
  @ApiQuery({ name: 'status', required: false, enum: SaleStatus })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: PaymentMethod })
  @CheckPermission({ subModule: SUB_MODULES.SALE, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: SaleStatus,
    @Query('paymentMethod') paymentMethod?: PaymentMethod,
  ) {
    return this.saleService.findAllSales(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
      status,
      paymentMethod,
    );
  }

  @ApiOperation({ summary: 'Get sale by ID' })
  @CheckPermission({ subModule: SUB_MODULES.SALE, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.saleService.findOneSale(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Cancel sale and restock inventory' })
  @CheckPermission({ subModule: SUB_MODULES.SALE, action: ACTIONS.DELETE })
  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.saleService.cancelSale(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
