import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { CreateStoreDto, UpdateStoreDto, UpdateTenantDto } from './tenants.dto';
import { TenantsService } from './tenants.service';

@ApiTags('settings')
@Controller()
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @Patch('settings')
  update(@CurrentUser() ctx: AuthContext, @Body() dto: UpdateTenantDto) {
    return this.tenants.updateSettings(ctx, dto);
  }

  /** Any signed-in user can list stores (used by the store switcher); access is still filtered. */
  @Get('stores')
  async stores(@CurrentUser() ctx: AuthContext, @Query('includeInactive') includeInactive?: string) {
    const canManage = ctx.permissions.has(Permission.STORES_MANAGE);
    const stores = await this.tenants.listStores(ctx, canManage && includeInactive === 'true');
    return stores.filter((s) => ctx.allStores || ctx.storeIds.includes(s.id));
  }

  @RequirePermissions(Permission.STORES_MANAGE)
  @Post('stores')
  createStore(@CurrentUser() ctx: AuthContext, @Body() dto: CreateStoreDto) {
    return this.tenants.createStore(ctx, dto);
  }

  @RequirePermissions(Permission.STORES_MANAGE)
  @Patch('stores/:id')
  updateStore(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoreDto) {
    return this.tenants.updateStore(ctx, id, dto);
  }
}
