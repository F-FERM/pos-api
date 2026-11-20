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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { SubCategoryService } from './sub-category.service';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('SubCategory')
@Controller('sub-category')
export class SubCategoryController {
  constructor(private readonly subCategoryService: SubCategoryService) {}

  @ApiOperation({ summary: 'Create sub-category' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateSubCategoryDto, @Req() req: AuthedRequest) {
    return this.subCategoryService.createSubCategory(
      { ...dto, companyId: req.user.companyId },
      req.user.userId,
      req,
    );
  }

  @ApiOperation({ summary: 'Get all sub-categories' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by main category ID',
  })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.subCategoryService.findAllSubCategories(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      req,
      categoryId,
      search,
    );
  }

  @ApiOperation({ summary: 'Get sub-category by ID' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.subCategoryService.findOneSubCategory(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update sub-category' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSubCategoryDto,
    @Req() req: AuthedRequest,
  ) {
    return this.subCategoryService.updateSubCategory(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete sub-category' })
  @CheckPermission({ subModule: SUB_MODULES.PRODUCT, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.subCategoryService.deleteSubCategory(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
