import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PrivilegeService } from './privilege.service';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { type AuthedRequest } from '../utils/common.types';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { Role } from '../utils/role.enum';
import { CreatePrivilegesDto, UpdatePrivilegesDto } from './dto/privilege.dto';
import { SkipSubscription } from '../common/decorators/skip-subscription.decorator';
import { CheckPermission } from '../common/decorators/check-permission.decorator';
import { ACTIONS } from '../common/constants/actions.constants';
import { SUB_MODULES } from '../common/constants/submodules.constants';

@Controller('privilege')
export class PrivilegeController {
  constructor(private readonly privilegeService: PrivilegeService) {}

  /**
   * Creates a new privilege.
   * @param {CreatePrivilegesDto} dto - The data for creating the privilege.
   * @param {AuthedRequest} req - The authenticated request containing user information.
   * @returns {Promise<any>} - A promise that resolves to the created privilege.
   * @memberof PrivilegeController
   */
  @ApiOperation({ summary: 'create privilege' })
  @CheckPermission({
    subModule: SUB_MODULES.USER,
    action: ACTIONS.CREATE,
  })
  @Roles(Role.admin, Role.superadmin)
  @Post()
  create(@Body() dto: CreatePrivilegesDto, @Req() req: AuthedRequest) {
    return this.privilegeService.createPrivilege(
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  /**
   * Retrieves all privileges.
   * @param {AuthedRequest} req - The authenticated request containing user information.
   * @param {number} take - The number of items to take.
   * @param {number} skip - The number of items to skip.
   * @param {string} search - Optional search term.
   * @returns {Promise<any>} - A promise that resolves to the list of privileges.
   * @memberof PrivilegeController
   */
  @ApiOperation({ summary: 'get all privileges' })
  @SkipSubscription()
  @CheckPermission(
    { subModule: SUB_MODULES.USER, action: ACTIONS.READ },
    { subModule: SUB_MODULES.USER, action: ACTIONS.CREATE },
  )
  @Roles(Role.superadmin, Role.admin)
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit,
    @Query('search') search?: string,
  ) {
    return this.privilegeService.findAllPrivileges(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
    );
  }

  /**
   * Retrieves a privilege by its ID.
   * @param {string} id - The ID of the privilege to retrieve.
   * @param {AuthedRequest} req - The authenticated request containing user information.
   * @returns {Promise<any>} - A promise that resolves to the privilege.
   * @memberof PrivilegeController
   */
  @ApiOperation({ summary: 'get privilege by id' })
  @SkipSubscription()
  @CheckPermission({ subModule: SUB_MODULES.USER, action: ACTIONS.READ })
  @Roles(Role.admin, Role.superadmin)
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.privilegeService.findOnePrivilegeById(
      id,
      req.user.userId,
      req.user.companyId,
    );
  }

  /**
   * Updates a privilege.
   * @param {string} id - The ID of the privilege to update.
   * @param {UpdatePrivilegesDto} dto - The data for updating the privilege.
   * @param {AuthedRequest} req - The authenticated request containing user information.
   * @returns {Promise<any>} - A promise that resolves to the updated privilege.
   * @memberof PrivilegeController
   */
  @ApiOperation({ summary: 'update privilege' })
  @CheckPermission({
    subModule: SUB_MODULES.USER,
    action: ACTIONS.UPDATE,
  })
  @Roles(Role.superadmin, Role.admin)
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdatePrivilegesDto,
    @Req() req: AuthedRequest,
  ) {
    return this.privilegeService.updatePrivilege(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  /**
   * Deletes a privilege.
   * @param {string} id - The ID of the privilege to delete.
   * @param {AuthedRequest} req - The authenticated request containing user information.
   * @returns {Promise<any>} - A promise that resolves to the result of the deletion.
   * @memberof PrivilegeController
   */
  @ApiOperation({ summary: 'delete privilege' })
  @CheckPermission({
    subModule: SUB_MODULES.USER,
    action: ACTIONS.DELETE,
  })
  @Roles(Role.superadmin, Role.admin)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.privilegeService.deletePrivilege(
      id,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }
}
