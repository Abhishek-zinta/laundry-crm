import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@rinseops/shared';
import type { Request } from 'express';
import type { AuthContext } from './auth-context';

export const IS_PUBLIC_KEY = 'rinseops:isPublic';
export const PERMISSIONS_KEY = 'rinseops:permissions';
export const ANY_PERMISSIONS_KEY = 'rinseops:anyPermissions';

/** Skip session authentication for this route. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Require every listed permission. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Require at least one of the listed permissions. */
export const RequireAnyPermission = (...permissions: Permission[]) => SetMetadata(ANY_PERMISSIONS_KEY, permissions);

export type AuthedRequest = Request & { auth?: AuthContext };

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.auth) throw new Error('CurrentUser used on an unauthenticated route');
  return req.auth;
});
