import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Expense')
@Controller('expense')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @ApiOperation({ summary: 'Create expense' })
  @CheckPermission({ subModule: SUB_MODULES.EXPENSE, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() req: AuthedRequest) {
    return this.expenseService.createExpense(
      { ...dto, companyId: req.user.companyId },
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Get all expenses' })
  @CheckPermission({ subModule: SUB_MODULES.EXPENSE, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.expenseService.findAllExpenses(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
    );
  }

  @ApiOperation({ summary: 'Delete expense' })
  @CheckPermission({ subModule: SUB_MODULES.EXPENSE, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.expenseService.deleteExpense(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
