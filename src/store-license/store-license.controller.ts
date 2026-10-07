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
import { StoreLicenseService } from './store-license.service';
import { CreateStoreLicenseDto } from './dto/create-store-license.dto';
import { UpdateStoreLicenseDto } from './dto/update-store-license.dto';
import { LicenseStatus } from '../models/store-license.schema';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../utils/role.enum';
import { type AuthedRequest } from '../utils/common.types';

@ApiTags('Store License (Superadmin)')
@Controller('store-license')
@Roles(Role.superadmin)
export class StoreLicenseController {
  constructor(private readonly licenseService: StoreLicenseService) {}

  @ApiOperation({
    summary: 'Superadmin: Generate / Create new store license key',
  })
  @Post()
  create(@Body() dto: CreateStoreLicenseDto, @Req() req: AuthedRequest) {
    return this.licenseService.createLicense(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Superadmin: Get all generated store licenses' })
  @ApiQuery({ name: 'status', required: false, enum: LicenseStatus })
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: LicenseStatus,
  ) {
    return this.licenseService.findAllLicenses(page, limit, status, search);
  }

  @ApiOperation({ summary: 'Superadmin: Get store license details by ID' })
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.licenseService.findOneLicense(id);
  }

  @ApiOperation({ summary: 'Superadmin: Update store license configuration' })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateStoreLicenseDto,
    @Req() req: AuthedRequest,
  ) {
    return this.licenseService.updateLicense(id, dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Superadmin: Revoke / Delete store license key' })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.licenseService.deleteLicense(id, req.user.userId, req);
  }
}
