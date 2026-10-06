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
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Customer')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @ApiOperation({ summary: 'Create customer' })
  @CheckPermission({ subModule: SUB_MODULES.CUSTOMER, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateCustomerDto, @Req() req: AuthedRequest) {
    return this.customerService.createCustomer(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all customers' })
  @CheckPermission({ subModule: SUB_MODULES.CUSTOMER, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.customerService.findAllCustomers(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
    );
  }

  @ApiOperation({ summary: 'Get customer by ID' })
  @CheckPermission({ subModule: SUB_MODULES.CUSTOMER, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.customerService.findOneCustomer(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update customer' })
  @CheckPermission({ subModule: SUB_MODULES.CUSTOMER, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: AuthedRequest,
  ) {
    return this.customerService.updateCustomer(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete customer' })
  @CheckPermission({ subModule: SUB_MODULES.CUSTOMER, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.customerService.deleteCustomer(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
