import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { BulkGarmentStatusDto, ChangeGarmentStatusDto, GarmentListQueryDto, UpdateGarmentDto } from './garments.dto';
import { GarmentsService } from './garments.service';

@ApiTags('garments')
@Controller('garments')
export class GarmentsController {
  constructor(private readonly garments: GarmentsService) {}

  @RequirePermissions(Permission.GARMENTS_VIEW)
  @Get()
  list(@CurrentUser() ctx: AuthContext, @Query() query: GarmentListQueryDto) {
    return this.garments.list(ctx, query);
  }

  @RequirePermissions(Permission.GARMENTS_VIEW)
  @Get('tag/:tagCode')
  byTag(@CurrentUser() ctx: AuthContext, @Param('tagCode') tagCode: string) {
    return this.garments.getByTag(ctx, tagCode);
  }

  @RequirePermissions(Permission.GARMENTS_VIEW)
  @Get(':id')
  get(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.garments.get(ctx, id);
  }

  @RequirePermissions(Permission.GARMENTS_UPDATE)
  @Patch(':id')
  update(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGarmentDto) {
    return this.garments.update(ctx, id, dto);
  }

  @RequirePermissions(Permission.GARMENTS_UPDATE)
  @HttpCode(200)
  @Post(':id/status')
  changeStatus(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeGarmentStatusDto) {
    return this.garments.changeStatus(ctx, id, dto);
  }

  @RequirePermissions(Permission.GARMENTS_UPDATE)
  @HttpCode(200)
  @Post('bulk-status')
  bulkStatus(@CurrentUser() ctx: AuthContext, @Body() dto: BulkGarmentStatusDto) {
    return this.garments.bulkStatus(ctx, dto);
  }
}
