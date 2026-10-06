import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @ApiOperation({ summary: 'Create product' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateProductDto, @Req() req: AuthedRequest) {
    return this.productService.createProduct(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all products' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'brandId', required: false })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'lowStockOnly', required: false, type: Boolean })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('lowStockOnly', new DefaultValuePipe(false), ParseBoolPipe)
    lowStockOnly?: boolean,
  ) {
    return this.productService.findAllProducts(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
      categoryId,
      brandId,
      supplierId,
      lowStockOnly,
    );
  }

  @ApiOperation({
    summary: 'Auto-generate unique product barcode for POS frontend',
  })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get('generate-barcode')
  generateBarcode(@Req() req: AuthedRequest) {
    return this.productService.generateUniqueBarcode(
      req.user.userId,
      req.user.companyId,
    );
  }

  @ApiOperation({ summary: 'Find product by barcode (Quick Scan)' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get('scan/:barcode')
  findByBarcode(@Param('barcode') barcode: string, @Req() req: AuthedRequest) {
    return this.productService.findProductByBarcode(
      barcode,
      req.user.userId,
      req.user.companyId,
    );
  }

  @ApiOperation({ summary: 'Get product by ID' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.productService.findOneProduct(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update product' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: AuthedRequest,
  ) {
    return this.productService.updateProduct(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete product' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.productService.deleteProduct(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
