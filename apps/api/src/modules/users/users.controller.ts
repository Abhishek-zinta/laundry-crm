import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import { CreateStaffDto, UpdateStaffDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('staff')
@Controller('staff')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermissions(Permission.STAFF_VIEW)
  @Get()
  list(@CurrentUser() ctx: AuthContext) {
    return this.users.list(ctx);
  }

  @RequireAnyPermission(Permission.TASKS_MANAGE, Permission.STAFF_VIEW)
  @Get('drivers')
  drivers(@CurrentUser() ctx: AuthContext, @Query('storeId') storeId?: string) {
    return this.users.drivers(ctx, storeId);
  }

  @RequirePermissions(Permission.STAFF_VIEW)
  @Get(':id')
  get(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(ctx, id);
  }

  @RequirePermissions(Permission.STAFF_MANAGE)
  @Post()
  create(@CurrentUser() ctx: AuthContext, @Body() dto: CreateStaffDto) {
    return this.users.create(ctx, dto);
  }

  @RequirePermissions(Permission.STAFF_MANAGE)
  @Patch(':id')
  update(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) {
    return this.users.update(ctx, id, dto);
  }
}
