import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { dashboardQuerySchema, Permission } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { DashboardService } from './dashboard.service';

class DashboardQueryDto extends createZodDto(dashboardQuerySchema) {}

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions(Permission.DASHBOARD_VIEW)
  @Get()
  overview(@CurrentUser() ctx: AuthContext, @Query() query: DashboardQueryDto) {
    return this.dashboard.overview(ctx, query.storeId);
  }
}
