import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@rinseops/shared';
import { ANY_PERMISSIONS_KEY, AuthedRequest, PERMISSIONS_KEY } from './decorators';

/** Enforces @RequirePermissions / @RequireAnyPermission on the server side. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const all = this.reflector.getAllAndMerge<Permission[]>(PERMISSIONS_KEY, targets) ?? [];
    const any = this.reflector.getAllAndOverride<Permission[] | undefined>(ANY_PERMISSIONS_KEY, targets);
    if (all.length === 0 && !any?.length) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const granted = req.auth?.permissions;
    if (!granted) throw new ForbiddenException("You don't have permission to do that.");

    const ok = all.every((p) => granted.has(p)) && (!any?.length || any.some((p) => granted.has(p)));
    if (!ok) throw new ForbiddenException("You don't have permission to do that.");
    return true;
  }
}
