import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditAction } from '@rinseops/shared';
import type { TenantDbOrTx } from '../prisma/tenant-extension';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditActor {
  tenantId: string;
  userId?: string | null;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Records an audit entry using the given (transactional) client so the log
   * is committed atomically with the change it describes.
   */
  async log(db: TenantDbOrTx, actor: AuditActor, entry: AuditEntry) {
    try {
      await db.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: actor.ipAddress ?? null,
        },
      });
    } catch (err) {
      // Inside a transaction an error must propagate so the whole change rolls back.
      this.logger.error(`Failed to write audit log ${entry.action}`, err instanceof Error ? err.stack : undefined);
      throw err;
    }
  }
}
