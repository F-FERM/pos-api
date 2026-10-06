import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { RegisterService } from './register.service';
import { OpenRegisterDto } from './dto/open-register.dto';
import { CloseRegisterDto } from './dto/close-register.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Register')
@Controller('register')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @ApiOperation({ summary: 'Open register shift session' })
  @CheckPermission({ subModule: SUB_MODULES.REGISTER, action: ACTIONS.CREATE })
  @Post('open')
  open(@Body() dto: OpenRegisterDto, @Req() req: AuthedRequest) {
    return this.registerService.openRegister(
      { ...dto, companyId: req.user.companyId },
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Get current active register session' })
  @CheckPermission({ subModule: SUB_MODULES.REGISTER, action: ACTIONS.READ })
  @Get('current')
  getCurrent(@Req() req: AuthedRequest) {
    return this.registerService.getCurrentSession(
      req.user.userId,
      req.user.companyId,
    );
  }

  @ApiOperation({ summary: 'Close register shift session' })
  @CheckPermission({ subModule: SUB_MODULES.REGISTER, action: ACTIONS.UPDATE })
  @Patch(':id/close')
  close(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CloseRegisterDto,
    @Req() req: AuthedRequest,
  ) {
    return this.registerService.closeRegister(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
