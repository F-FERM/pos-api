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
import { ApiOperation } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @ApiOperation({ summary: 'Create company' })
  @CheckPermission({ subModule: SUB_MODULES.COMPANY, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateCompanyDto, @Req() req: AuthedRequest) {
    return this.companyService.createCompany(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all companies' })
  @CheckPermission({ subModule: SUB_MODULES.COMPANY, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.companyService.findAllCompanies(
      req.user.userId,
      req.user.roles,
      page,
      limit,
      search,
    );
  }

  @ApiOperation({ summary: 'Get company by id' })
  @CheckPermission({ subModule: SUB_MODULES.COMPANY, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.companyService.findOneCompany(
      id,
      req.user.userId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update company' })
  @CheckPermission({ subModule: SUB_MODULES.COMPANY, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @Req() req: AuthedRequest,
  ) {
    return this.companyService.updateCompany(
      id,
      dto,
      req.user.userId,
      req.user.roles,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete company' })
  @CheckPermission({ subModule: SUB_MODULES.COMPANY, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.companyService.deleteCompany(id, req.user.userId, req);
  }
}
