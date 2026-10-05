import { Controller, Get, Param } from '@nestjs/common';
import { ModuleService } from './module.service';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiOperation } from '@nestjs/swagger';
import { SkipSubscription } from '../common/decorators/skip-subscription.decorator';

@Controller('sub-module')
export class SubModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @ApiOperation({ summary: 'Get all submodules' })
  @SkipSubscription()
  @Get()
  findAll() {
    return this.moduleService.getAllSubModules();
  }

  @ApiOperation({ summary: 'Get submodule by ID' })
  @SkipSubscription()
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.moduleService.getSubModuleById(id);
  }

  @ApiOperation({ summary: 'Get submodules by module ID' })
  @SkipSubscription()
  @Get('module/:moduleId')
  findByModule(@Param('moduleId', ParseObjectIdPipe) moduleId: string) {
    return this.moduleService.getSubModulesByModuleId(moduleId);
  }
}
