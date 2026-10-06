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
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Purchase')
@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @ApiOperation({ summary: 'Create purchase bill & adjust stock' })
  @CheckPermission({ subModule: SUB_MODULES.PURCHASE, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreatePurchaseDto, @Req() req: AuthedRequest) {
    return this.purchaseService.createPurchase(
      { ...dto, companyId: req.user.companyId },
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Get all purchase bills' })
  @CheckPermission({ subModule: SUB_MODULES.PURCHASE, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.purchaseService.findAllPurchases(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
    );
  }

  @ApiOperation({ summary: 'Get purchase bill by ID' })
  @CheckPermission({ subModule: SUB_MODULES.PURCHASE, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.purchaseService.findOnePurchase(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }
}
