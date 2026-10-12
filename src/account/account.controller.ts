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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateAccountTransactionDto } from './dto/create-account-transaction.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';
import { AccountType } from '../models/account.schema';

@ApiTags('Chart of Accounts & Finance')
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @ApiOperation({ summary: 'Create custom account in Chart of Accounts' })
  @CheckPermission({ subModule: SUB_MODULES.ACCOUNT, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateAccountDto, @Req() req: AuthedRequest) {
    return this.accountService.createAccount(
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Get all accounts (Chart of Accounts)' })
  @ApiQuery({ name: 'type', required: false, enum: AccountType })
  @ApiQuery({ name: 'search', required: false })
  @CheckPermission({ subModule: SUB_MODULES.ACCOUNT, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: AccountType,
    @Query('search') search?: string,
  ) {
    return this.accountService.findAllAccounts(
      req.user.companyId,
      req.user.userId,
      req.user.roles,
      page,
      limit,
      type,
      search,
    );
  }

  @ApiOperation({ summary: 'Get financial summary statement (Assets, Liabilities, Income, Expenses)' })
  @CheckPermission({ subModule: SUB_MODULES.ACCOUNT, action: ACTIONS.READ })
  @Get('financial-summary')
  getFinancialSummary(@Req() req: AuthedRequest) {
    return this.accountService.getFinancialSummary(
      req.user.companyId,
      req.user.userId,
    );
  }

  @ApiOperation({ summary: 'Get account details by ID' })
  @CheckPermission({ subModule: SUB_MODULES.ACCOUNT, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.accountService.findOneAccount(
      id,
      req.user.companyId,
      req.user.userId,
    );
  }

  @ApiOperation({ summary: 'Get transaction ledger history for an account' })
  @CheckPermission({ subModule: SUB_MODULES.ACCOUNT, action: ACTIONS.READ })
  @Get(':id/ledger')
  getLedger(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.accountService.getAccountLedger(
      id,
      req.user.companyId,
      req.user.userId,
      page,
      limit,
    );
  }

  @ApiOperation({ summary: 'Post manual account transaction entry' })
  @CheckPermission({ subModule: SUB_MODULES.ACCOUNT, action: ACTIONS.CREATE })
  @Post('transaction')
  recordTransaction(
    @Body() dto: CreateAccountTransactionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.accountService.recordManualTransaction(
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Update account details' })
  @CheckPermission({ subModule: SUB_MODULES.ACCOUNT, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: AuthedRequest,
  ) {
    return this.accountService.updateAccount(
      id,
      dto,
      req.user.companyId,
      req.user.userId,
      req,
    );
  }

  @ApiOperation({
    summary: 'Delete custom account (Protected: System accounts cannot be deleted)',
  })
  @CheckPermission({ subModule: SUB_MODULES.ACCOUNT, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.accountService.deleteAccount(
      id,
      req.user.companyId,
      req.user.userId,
      req,
    );
  }
}
