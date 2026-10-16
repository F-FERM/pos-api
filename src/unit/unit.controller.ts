import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../utils/role.enum';
import type { AuthedRequest } from '../utils/common.types';

@ApiTags('Unit')
@Controller('unit')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Post()
  @Roles(Role.admin, Role.user)
  @ApiOperation({ summary: 'Create a new unit of measurement' })
  async createUnit(
    @Body() dto: CreateUnitDto,
    @Req() req: AuthedRequest,
  ) {
    const { userId, companyId } = req.user;
    return this.unitService.createUnit(
      dto,
      companyId,
      userId,
      req,
    );
  }

  @Get()
  @Roles(Role.admin, Role.user)
  @ApiOperation({ summary: 'Get all units for store with pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false })
  async findAllUnits(
    @Req() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const { userId, companyId, roles } = req.user;
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    return this.unitService.findAllUnits(
      userId,
      companyId,
      roles,
      pageNum,
      limitNum,
      search,
    );
  }

  @Get(':id')
  @Roles(Role.admin, Role.user)
  @ApiOperation({ summary: 'Get unit details by ID' })
  async findOneUnitById(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    const { userId, companyId } = req.user;
    return this.unitService.findOneUnitById(id, userId, companyId);
  }

  @Patch(':id')
  @Roles(Role.admin, Role.user)
  @ApiOperation({ summary: 'Update unit details' })
  async updateUnit(
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
    @Req() req: AuthedRequest,
  ) {
    const { userId, companyId } = req.user;
    return this.unitService.updateUnit(id, dto, userId, companyId, req);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Soft delete unit by ID' })
  async deleteUnit(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    const { userId, companyId } = req.user;
    return this.unitService.deleteUnit(id, userId, companyId, req);
  }
}
