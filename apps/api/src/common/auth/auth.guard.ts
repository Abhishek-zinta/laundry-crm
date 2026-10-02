import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALL_STORE_ROLES, permissionsForRole, Role } from '@rinseops/shared';
import { SESSION_COOKIE } from '../../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from './auth-context';
import { AuthedRequest, IS_PUBLIC_KEY } from './decorators';
import { hashSessionToken } from './session-token';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Resolves the session cookie into an AuthContext. Applied globally;
 * routes opt out with @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Please sign in to continue.');
    }

    const auth = await this.resolve(token, req.ip);
    if (!auth) {
      if (isPublic) return true;
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    req.auth = auth;
    return true;
  }

  private async resolve(token: string, ip?: string): Promise<AuthContext | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          include: {
            tenant: { select: { status: true } },
            stores: { select: { storeId: true, store: { select: { isActive: true } } } },
          },
        },
      },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now) return null;
    const { user } = session;
    if (user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') return null;

    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    const role = user.role as Role;
    const allStores = ALL_STORE_ROLES.includes(role);
    let storeIds: string[];
    if (allStores) {
      const stores = await this.prisma.store.findMany({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      storeIds = stores.map((s) => s.id);
    } else {
      storeIds = user.stores.filter((s) => s.store.isActive).map((s) => s.storeId);
    }

    return {
      sessionId: session.id,
      userId: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role,
      permissions: new Set(permissionsForRole(role)),
      allStores,
      storeIds,
      ipAddress: ip,
    };
  }
}
