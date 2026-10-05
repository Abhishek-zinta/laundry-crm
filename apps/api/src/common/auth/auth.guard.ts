import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALL_STORE_ROLES, permissionsForRole, Role } from '@rinseops/shared';
import { SESSION_COOKIE } from '../../config/env';
import { MobileTokenService } from '../../modules/mobile-auth/mobile-token.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from './auth-context';
import { AuthedRequest, IS_PUBLIC_KEY } from './decorators';
import { hashSessionToken } from './session-token';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

interface SessionUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  tenant: { status: string };
  stores: Array<{ storeId: string; store: { isActive: boolean } }>;
}

const USER_INCLUDE = {
  tenant: { select: { status: true } },
  stores: { select: { storeId: true, store: { select: { isActive: true } } } },
} as const;

/**
 * Resolves the caller into an AuthContext. Applied globally; routes opt out with @Public().
 *  - Web: HttpOnly session cookie (unchanged).
 *  - Native app: `Authorization: Bearer <access token>` issued by /mobile/auth.
 * Both paths re-check the session and the user's status on every request, so
 * revoked sessions and deactivated users lose access immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly mobileTokens: MobileTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const authorization = req.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      const auth = await this.resolveBearer(authorization.slice(7).trim(), req.ip);
      if (!auth) {
        if (isPublic) return true;
        throw new UnauthorizedException('Your session has expired. Please sign in again.');
      }
      req.auth = auth;
      return true;
    }

    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Please sign in to continue.');
    }
    const auth = await this.resolveCookie(token, req.ip);
    if (!auth) {
      if (isPublic) return true;
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    req.auth = auth;
    return true;
  }

  private async resolveCookie(token: string, ip?: string): Promise<AuthContext | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { include: USER_INCLUDE } },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now) return null;
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }
    return this.buildContext(session.user, session.id, 'cookie', ip);
  }

  private async resolveBearer(token: string, ip?: string): Promise<AuthContext | null> {
    const claims = this.mobileTokens.verify(token);
    if (!claims) return null;
    const session = await this.prisma.mobileSession.findUnique({
      where: { id: claims.sid },
      include: { user: { include: USER_INCLUDE } },
    });
    const now = new Date();
    if (!session || session.expiresAt <= now) return null;
    if (session.revokedAt) {
      // Right after a refresh, the previous access token may still be in flight; accept it
      // until it expires, but only while its family is alive. Logout or reuse detection
      // revokes the whole family and ends every outstanding access token immediately.
      if (session.revokedReason !== 'ROTATED') return null;
      const alive = await this.prisma.mobileSession.count({ where: { familyId: session.familyId, revokedAt: null } });
      if (!alive) return null;
    }
    if (session.userId !== claims.sub || session.tenantId !== claims.tid || session.user.tenantId !== claims.tid) return null;
    if (now.getTime() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.mobileSession.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    }
    return this.buildContext(session.user, session.id, 'mobile', ip);
  }

  private async buildContext(user: SessionUser, sessionId: string, authType: AuthContext['authType'], ip?: string): Promise<AuthContext | null> {
    if (user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') return null;
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
      sessionId,
      authType,
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
