import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { AssignRackDto, CreateRackDto, CreateRackSlotDto, UpdateRackDto, UpdateRackSlotDto } from './racks.dto';
import { RacksService } from './racks.service';

@ApiTags('racks')
@Controller()
export class RacksController {
  constructor(private readonly racks: RacksService) {}

  @RequirePermissions(Permission.RACKS_VIEW)
  @Get('racks')
  board(@CurrentUser() ctx: AuthContext, @Query('storeId') storeId?: string) {
    return this.racks.board(ctx, storeId);
  }

  @RequirePermissions(Permission.RACKS_MANAGE)
  @Post('racks')
  create(@CurrentUser() ctx: AuthContext, @Body() dto: CreateRackDto) {
    return this.racks.createRack(ctx, dto);
  }

  @RequirePermissions(Permission.RACKS_MANAGE)
  @Patch('racks/:id')
  update(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRackDto) {
    return this.racks.updateRack(ctx, id, dto);
  }

  @RequirePermissions(Permission.RACKS_MANAGE)
  @Post('racks/:id/slots')
  addSlot(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateRackSlotDto) {
    return this.racks.addSlot(ctx, id, dto);
  }

  @RequirePermissions(Permission.RACKS_MANAGE)
  @Patch('racks/slots/:slotId')
  updateSlot(@CurrentUser() ctx: AuthContext, @Param('slotId', ParseUUIDPipe) slotId: string, @Body() dto: UpdateRackSlotDto) {
    return this.racks.updateSlot(ctx, slotId, dto);
  }

  @RequirePermissions(Permission.RACKS_ASSIGN)
  @Post('orders/:id/rack')
  assign(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRackDto) {
    return this.racks.assign(ctx, id, dto);
  }

  @RequirePermissions(Permission.RACKS_ASSIGN)
  @Delete('orders/:id/rack')
  remove(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.racks.remove(ctx, id);
  }
}
