import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { auditListQuerySchema, Permission } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

class AuditListQueryDto extends createZodDto(auditListQuerySchema) {}

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get()
  async list(@CurrentUser() ctx: AuthContext, @Query() query: AuditListQueryDto) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const where = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    };
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { id: true, name: true, role: true } } },
      }),
      db.auditLog.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
