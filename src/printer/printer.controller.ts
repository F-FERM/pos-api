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
import { PrinterService } from './printer.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Printer')
@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @ApiOperation({ summary: 'Create store / counter printer' })
  @CheckPermission({ subModule: SUB_MODULES.PRINTER, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreatePrinterDto, @Req() req: AuthedRequest) {
    return this.printerService.createPrinter(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all store printers' })
  @CheckPermission({ subModule: SUB_MODULES.PRINTER, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.printerService.findAllPrinters(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      req,
      search,
    );
  }

  @ApiOperation({ summary: 'Get printer by ID' })
  @CheckPermission({ subModule: SUB_MODULES.PRINTER, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.printerService.findOnePrinter(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update printer configuration' })
  @CheckPermission({ subModule: SUB_MODULES.PRINTER, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdatePrinterDto,
    @Req() req: AuthedRequest,
  ) {
    return this.printerService.updatePrinter(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete printer configuration' })
  @CheckPermission({ subModule: SUB_MODULES.PRINTER, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.printerService.deletePrinter(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
