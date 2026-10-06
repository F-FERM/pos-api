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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { type AuthedRequest } from '../utils/common.types';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { SUB_MODULES } from '../common/constants/submodules.constants';
import { ACTIONS } from '../common/constants/actions.constants';

@ApiTags('Staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({
    summary: 'Create new staff member (auto converts to user account)',
  })
  @CheckPermission({ subModule: SUB_MODULES.STAFF, action: ACTIONS.CREATE })
  @Post()
  create(@Body() dto: CreateStaffDto, @Req() req: AuthedRequest) {
    return this.staffService.createStaff(dto, req.user.userId, req);
  }

  @ApiOperation({ summary: 'Get all store staff members' })
  @CheckPermission({ subModule: SUB_MODULES.STAFF, action: ACTIONS.READ })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.staffService.findAllStaff(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      req,
      search,
    );
  }

  @ApiOperation({ summary: 'Get staff member details by ID' })
  @CheckPermission({ subModule: SUB_MODULES.STAFF, action: ACTIONS.READ })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.staffService.findOneStaff(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  @ApiOperation({ summary: 'Update staff member details and user account' })
  @CheckPermission({ subModule: SUB_MODULES.STAFF, action: ACTIONS.UPDATE })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @Req() req: AuthedRequest,
  ) {
    return this.staffService.updateStaff(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  @ApiOperation({ summary: 'Delete staff member and linked user account' })
  @CheckPermission({ subModule: SUB_MODULES.STAFF, action: ACTIONS.DELETE })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.staffService.deleteStaff(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
