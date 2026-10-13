import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncPushDto } from './dto/sync-push.dto';
import { SyncPullDto } from './dto/sync-pull.dto';
import { type AuthedRequest } from '../utils/common.types';

@ApiTags('Bi-Directional Cloud-Local Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @ApiOperation({
    summary: 'Push local records up to Cloud DB (Local -> Cloud Upward Sync)',
  })
  @Post('push')
  pushLocalData(@Body() dto: SyncPushDto, @Req() req: AuthedRequest) {
    return this.syncService.pushLocalDataToCloud(
      req.user.companyId,
      req.user.userId,
      dto,
    );
  }

  @ApiOperation({
    summary:
      'Pull cloud delta updates down to Local DB (Cloud -> Local Downward Sync)',
  })
  @Post('pull')
  pullCloudData(@Body() dto: SyncPullDto, @Req() req: AuthedRequest) {
    return this.syncService.pullCloudDataForCompany(
      req.user.companyId,
      req.user.userId,
      dto,
    );
  }

  @ApiOperation({
    summary:
      'Unified Bi-Directional Sync (Atomic Push + Pull in one HTTP request)',
  })
  @ApiQuery({
    name: 'lastSyncedAt',
    required: false,
    description: 'ISO timestamp of last successful sync',
  })
  @Post('bi-directional')
  biDirectionalSync(
    @Body() dto: SyncPushDto,
    @Query('lastSyncedAt') lastSyncedAt: string,
    @Req() req: AuthedRequest,
  ) {
    return this.syncService.biDirectionalSync(
      req.user.companyId,
      req.user.userId,
      dto,
      lastSyncedAt,
    );
  }

  @ApiOperation({
    summary: 'Get sync status, server time, and store user/counter capacities',
  })
  @Get('status')
  getSyncStatus(@Req() req: AuthedRequest) {
    return this.syncService.getSyncStatus(req.user.companyId, req.user.userId);
  }
}
