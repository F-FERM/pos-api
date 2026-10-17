import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WeighScaleService } from './weigh-scale.service';
import { UpdateWeighScaleSettingsDto } from './dto/update-scale-settings.dto';
import { ParseScaleBarcodeDto } from './dto/parse-scale-barcode.dto';
import { ParseDirectWeightDto } from './dto/parse-direct-weight.dto';
import { CalculateWeightDto } from './dto/calculate-weight.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../utils/role.enum';
import { type AuthedRequest } from '../utils/common.types';

@ApiTags('Weigh Scale')
@Controller('weigh-scale')
export class WeighScaleController {
  constructor(private readonly weighScaleService: WeighScaleService) {}

  @Get('settings')
  @Roles(Role.admin, Role.user)
  @ApiOperation({
    summary: 'Get store weigh scale configuration settings',
    description:
      'Retrieves the weigh scale settings (barcode prefix, barcode type, weight multiplier, direct scale settings) for the company store.',
  })
  async getSettings(@Req() req: AuthedRequest) {
    const { userId, companyId } = req.user;
    return this.weighScaleService.getScaleSettings(companyId, userId);
  }

  @Patch('settings')
  @Roles(Role.admin)
  @ApiOperation({
    summary: 'Update store weigh scale configuration settings',
    description:
      'Configures store weigh scale parameters (enable/disable, 2-digit scale barcode prefix, WEIGHT_EMBEDDED vs PRICE_EMBEDDED, USB/Serial COM port protocol).',
  })
  async updateSettings(
    @Body() dto: UpdateWeighScaleSettingsDto,
    @Req() req: AuthedRequest,
  ) {
    const { userId, companyId } = req.user;
    return this.weighScaleService.updateScaleSettings(
      dto,
      companyId,
      userId,
      req,
    );
  }

  @Post('parse-barcode')
  @Roles(Role.admin, Role.user)
  @ApiOperation({
    summary: 'Parse weighing scale sticker barcode for checkout',
    description:
      'Parses scale barcode stickers (e.g., 2100012015003), extracts PLU and weight/price, resolves product from store catalog, and calculates checkout item quantity and subtotal.',
  })
  async parseBarcode(
    @Body() dto: ParseScaleBarcodeDto,
    @Req() req: AuthedRequest,
  ) {
    const { userId, companyId } = req.user;
    return this.weighScaleService.parseScaleBarcode(
      dto.barcode,
      companyId,
      userId,
    );
  }

  @Post('parse-direct-weight')
  @Roles(Role.admin, Role.user)
  @ApiOperation({
    summary: 'Parse raw ASCII buffer read from direct USB/Serial COM scale',
    description:
      'Parses raw serial scale string data (CAS, NCI, Toledo, Dibal) read from direct checkout scale via Web Serial API or scale agent, extracts weight, deducts tare packaging, and calculates total price.',
  })
  async parseDirectWeight(
    @Body() dto: ParseDirectWeightDto,
    @Req() req: AuthedRequest,
  ) {
    const { userId, companyId } = req.user;
    return this.weighScaleService.parseDirectWeight(
      dto.rawData,
      companyId,
      userId,
      dto.productId,
      dto.protocol,
    );
  }

  @Post('calculate-weight')
  @Roles(Role.admin, Role.user)
  @ApiOperation({
    summary: 'Calculate item pricing for weighed produce with tare deduction',
    description:
      'Calculates net weight and subtotal for a product given a gross weight reading and optional tare container deduction.',
  })
  async calculateWeight(
    @Body() dto: CalculateWeightDto,
    @Req() req: AuthedRequest,
  ) {
    const { userId, companyId } = req.user;
    return this.weighScaleService.calculateWeight(
      dto.productId,
      dto.grossWeight,
      companyId,
      userId,
      dto.tareWeightOverride,
    );
  }
}
