import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { allowedOrigins } from '../../config/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated, state-changing requests.
 * Session cookies are SameSite=Lax; additionally we reject cross-site
 * requests based on Origin / Sec-Fetch-Site headers.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly origins = new Set(allowedOrigins());

  use(req: Request, res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) return next();

    const fetchSite = req.headers['sec-fetch-site'];
    const origin = req.headers.origin;

    if (fetchSite === 'cross-site' && !(origin && this.origins.has(origin))) {
      return reject(res);
    }
    if (origin && !this.origins.has(origin) && !isSameHost(origin, req)) {
      return reject(res);
    }
    next();
  }
}

function isSameHost(origin: string, req: Request): boolean {
  try {
    const host = req.headers['x-forwarded-host'] ?? req.headers.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function reject(res: Response) {
  res.status(403).json({
    statusCode: 403,
    error: { code: 'CSRF_REJECTED', message: 'This request was blocked for security reasons.' },
  });
}
