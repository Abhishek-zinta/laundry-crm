import { Controller, Get, Param, ParseEnumPipe, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission, REPORT_TYPES, reportQuerySchema, ReportType } from '@rinseops/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { ReportsService } from './reports.service';

class ReportQueryDto extends createZodDto(reportQuerySchema) {}

const REPORT_TYPE_ENUM = Object.fromEntries(REPORT_TYPES.map((t) => [t, t]));

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @RequirePermissions(Permission.REPORTS_VIEW)
  @Get(':type')
  async run(
    @CurrentUser() ctx: AuthContext,
    @Param('type', new ParseEnumPipe(REPORT_TYPE_ENUM)) type: ReportType,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const report = await this.reports.run(ctx, type, query);
    if (query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rinseops-${type}-${report.range.from}_${report.range.to}.csv"`);
      return this.reports.toCsv(report);
    }
    return report;
  }
}
