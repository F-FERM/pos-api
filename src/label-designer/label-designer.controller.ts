import { Body, Controller, Get, Header, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LabelDesignerService } from './label-designer.service';
import { GenerateLabelDto } from './dto/generate-label.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { Public } from '../auth/public.decorator';
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


  //TODO: Add proper authorization guards for superadmin routes
  @ApiOperation({
    summary:
      'Public test endpoint: Generate a sample sticker label design JSON using seed default data without auth or company ID',
  })
  @Public()
  @Post('test-print')
  sendTestLabelPrint(@Query('companyId') companyId?: string) {
    return this.labelDesignerService.generateTestLabel(companyId);
  }

  //TODO: Add proper authorization guards for superadmin routes
  @ApiOperation({
    summary:
      'Public HTML preview endpoint: Returns direct HTML rendered sticker label view for browser testing',
  })
  @Public()
  @Get('test-print/html')
  @Header('Content-Type', 'text/html')
  async sendTestLabelPrintHtml(@Query('companyId') companyId?: string) {
    const result = await this.labelDesignerService.generateTestLabel(companyId);
    return result.data.html;
  }
}
