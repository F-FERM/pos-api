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
import { DeviceRegistrationService } from './device-registration.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { VerifyDeviceDto } from './dto/verify-device.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { Public } from '../auth/public.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Device Registration & License')
@Controller('device')
export class DeviceRegistrationController {
  constructor(private readonly deviceService: DeviceRegistrationService) {}

  @ApiOperation({
    summary:
      'Public startup verification for Windows desktop app (bypasses setup for registered store terminals)',
  })
  @Public()
  @Post('verify')
  verifyDevice(@Body() dto: VerifyDeviceDto, @Req() req: AuthedRequest) {
    return this.deviceService.verifyDevice(dto, req);
  }

  @ApiOperation({
    summary:
      'Public terminal PC registration/activation using Store License Key',
  })
  @Public()
  @Post('register')
  registerDevice(@Body() dto: RegisterDeviceDto, @Req() req: AuthedRequest) {
    return this.deviceService.registerDevice(dto, req);
  }

  @ApiOperation({ summary: 'Get all registered terminal PCs for store' })
  @CheckPermission({
    subModule: SUB_MODULES.DEVICE_REGISTRATION,
    action: ACTIONS.READ,
  })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.deviceService.findAllDevices(
      req.user.companyId,
      req.user.userId,
      req.user.roles,
      page,
      limit,
      req,
      search,
    );
  }

  @ApiOperation({
    summary: 'Toggle inhouse LAN auto-bypass mode for a terminal PC',
  })
  @CheckPermission({
    subModule: SUB_MODULES.DEVICE_REGISTRATION,
    action: ACTIONS.UPDATE,
  })
  @Patch(':id/bypass')
  toggleBypass(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body('isBypassedInhouse') isBypassedInhouse: boolean,
    @Req() req: AuthedRequest,
  ) {
    return this.deviceService.toggleBypassInhouse(
      id,
      isBypassedInhouse,
      req.user.companyId,
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Revoke terminal PC registration license' })
  @CheckPermission({
    subModule: SUB_MODULES.DEVICE_REGISTRATION,
    action: ACTIONS.DELETE,
  })
  @Delete(':id/revoke')
  revoke(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.deviceService.revokeDevice(
      id,
      req.user.companyId,
      req.user.userId,
      req,
    );
  }
}
