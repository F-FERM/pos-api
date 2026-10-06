import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LabelDesignerService } from './label-designer.service';
import { GenerateLabelDto } from './dto/generate-label.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Label Designer')
@Controller('label-designer')
export class LabelDesignerController {
  constructor(private readonly labelDesignerService: LabelDesignerService) {}

  @ApiOperation({
    summary:
      'Generate barcode thermal sticker labels (Company -> Product Name -> Barcode Lines -> Barcode Value -> Price)',
  })
  @CheckPermission({
    subModule: SUB_MODULES.LABEL_DESIGNER,
    action: ACTIONS.READ,
  })
  @Post('generate')
  generateLabels(@Body() dto: GenerateLabelDto, @Req() req: AuthedRequest) {
    return this.labelDesignerService.generateLabels(dto, req.user.userId, req);
  }
}
