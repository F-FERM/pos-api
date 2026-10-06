import { Body, Controller, Get, Patch, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoyaltySettingService } from './loyalty-setting.service';
import { UpdateLoyaltySettingDto } from './dto/update-loyalty-setting.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Loyalty Settings')
@Controller('loyalty-settings')
export class LoyaltySettingController {
  constructor(private readonly loyaltyService: LoyaltySettingService) {}

  @ApiOperation({ summary: 'Get company loyalty program settings' })
  @CheckPermission({
    subModule: SUB_MODULES.LOYALTY_SETTING,
    action: ACTIONS.READ,
  })
  @Get()
  getSetting(
    @Query('companyId') companyId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.loyaltyService.getSetting(
      companyId || req.user.companyId,
      req.user.userId,
    );
  }

  @ApiOperation({ summary: 'Update company loyalty program configuration' })
  @CheckPermission({
    subModule: SUB_MODULES.LOYALTY_SETTING,
    action: ACTIONS.UPDATE,
  })
  @Patch()
  updateSetting(
    @Body() dto: UpdateLoyaltySettingDto,
    @Req() req: AuthedRequest,
  ) {
    return this.loyaltyService.upsertSetting(dto, req.user.userId, req);
  }
}
