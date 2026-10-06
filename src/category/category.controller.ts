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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Category')
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({ summary: 'Create category' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateCategoryDto, @Req() req: AuthedRequest) {
    return this.categoryService.createCategory(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all categories' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.categoryService.findAllCategories(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      req,
      search,
    );
  }

  @ApiOperation({ summary: 'Get category by ID' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.categoryService.findOneCategory(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update category' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: AuthedRequest,
  ) {
    return this.categoryService.updateCategory(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete category' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.categoryService.deleteCategory(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
