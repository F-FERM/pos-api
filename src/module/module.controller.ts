import { Controller, Get, Param, Req } from '@nestjs/common';
import { ModuleService } from './module.service';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiOperation } from '@nestjs/swagger';
import { type AuthedRequest } from '../utils/common.types';
import { SkipSubscription } from '../common/decorators/skip-subscription.decorator';

@Controller('module')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  /**
   * Retrieves all modules from the database.
   * @returns {Promise<ModuleDocument[]>} A promise that resolves to an array of all modules.
   */
  @ApiOperation({ summary: 'get all modules' })
  @SkipSubscription()
  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.moduleService.findAllModules(req);
  }

  /**
   * Retrieves a module by its ID from the database.
   * @param {string} id - The ID of the module to retrieve.
   * @returns {Promise<ModuleDocument>} A promise that resolves to the retrieved module.
   */
  @ApiOperation({ summary: 'get module by id' })
  @SkipSubscription()
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.moduleService.findOneModuleById(id);
  }
}
