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
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Brand')
@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @ApiOperation({ summary: 'Create brand' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateBrandDto, @Req() req: AuthedRequest) {
    return this.brandService.createBrand(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all brands' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.brandService.findAllBrands(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
    );
  }

  @ApiOperation({ summary: 'Get brand by ID' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.brandService.findOneBrand(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update brand' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateBrandDto,
    @Req() req: AuthedRequest,
  ) {
    return this.brandService.updateBrand(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete brand' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.brandService.deleteBrand(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
