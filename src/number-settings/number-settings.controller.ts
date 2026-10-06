import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { NumberSettingsService } from './number-settings.service';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { UpdateNumberSettingDto } from './dto/number-settings.dto';
import { numberSettingsDocumentType } from '../utils/common.enum';
import { type AuthedRequest } from '../utils/common.types';
import { ParseObjectIdPipe } from '@nestjs/mongoose';

@ApiTags('Number Settings')
@Controller('number-settings')
export class NumberSettingsController {
  constructor(private readonly numberSettingsService: NumberSettingsService) {}

  @ApiOperation({ summary: 'Create or Update number setting' })
  @Post()
  async upsert(@Body() dto: UpdateNumberSettingDto, @Req() req: AuthedRequest) {
    return this.numberSettingsService.upsertSetting(
      req.user.companyId,
      req.user.userId,
      dto.docType,
      dto,
    );
  }

  @ApiOperation({
    summary: 'Get all number settings for the company',
    description:
      "Retrieves all number settings configured for the authenticated user's company.",
  })
  @ApiResponse({
    status: 404,
    description: 'No number settings found for this company',
  })
  @Get()
  async getAll(@Req() req: AuthedRequest) {
    return this.numberSettingsService.getAllSettings(
      req.user.companyId,
      req.user.userId,
    );
  }

  @ApiOperation({
    summary: 'Get number setting by ID',
    description:
      'Retrieves a specific number setting configuration using its unique ID.',
  })
  @ApiResponse({ status: 404, description: 'Number setting not found' })
  @Get(':id')
  async getById(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.numberSettingsService.getById(
      id,
      req.user.companyId,
      req.user.userId,
    );
  }

  @ApiOperation({
    summary: 'Get number setting by document type',
    description:
      'Retrieves the number setting configuration for a specific document type.',
  })
  @ApiResponse({ status: 404, description: 'Number setting not found' })
  @Get('doc-type/:docType')
  async getByDocType(
    @Param('docType') docType: numberSettingsDocumentType,
    @Req() req: AuthedRequest,
  ) {
    return this.numberSettingsService.getOne(
      req.user.companyId,
      req.user.userId,
      docType,
    );
  }
}
