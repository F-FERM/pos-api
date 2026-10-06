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
import { CounterService } from './counter.service';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Counter')
@Controller('counter')
export class CounterController {
  constructor(private readonly counterService: CounterService) {}

  @ApiOperation({ summary: 'Create checkout counter' })
  @CheckPermission({ subModule: SUB_MODULES.COUNTER, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateCounterDto, @Req() req: AuthedRequest) {
    return this.counterService.createCounter(
      { ...dto, companyId: req.user.companyId },
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Get all store counters' })
  @CheckPermission({ subModule: SUB_MODULES.COUNTER, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.counterService.findAllCounters(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      req,
      search,
    );
  }

  @ApiOperation({ summary: 'Get counter by ID' })
  @CheckPermission({ subModule: SUB_MODULES.COUNTER, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.counterService.findOneCounter(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update counter details' })
  @CheckPermission({ subModule: SUB_MODULES.COUNTER, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCounterDto,
    @Req() req: AuthedRequest,
  ) {
    return this.counterService.updateCounter(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete counter' })
  @CheckPermission({ subModule: SUB_MODULES.COUNTER, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.counterService.deleteCounter(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
