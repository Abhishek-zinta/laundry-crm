import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '../../config/env';

export interface MobileAccessClaims {
  /** User id */
  sub: string;
  /** Tenant id */
  tid: string;
  /** Mobile session (refresh family member) id */
  sid: string;
  typ: 'mobile_access';
}

export const MOBILE_TOKEN_ISSUER = 'rinseops-api';
export const MOBILE_TOKEN_AUDIENCE = 'rinseops-mobile';

/** Signs and verifies short-lived native-app access tokens (HS256 JWT). */
@Injectable()
export class MobileTokenService {
  constructor(private readonly jwt: JwtService) {}

  accessTtlSeconds(): number {
    return env().MOBILE_ACCESS_TTL_MINUTES * 60;
  }

  sign(claims: Omit<MobileAccessClaims, 'typ'>): { token: string; expiresAt: Date } {
    const ttl = this.accessTtlSeconds();
    const token = this.jwt.sign({ ...claims, typ: 'mobile_access' }, { expiresIn: ttl });
    return { token, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  /** Returns the claims, or null for any invalid/expired/foreign token. */
  verify(token: string): MobileAccessClaims | null {
    try {
      const claims = this.jwt.verify<MobileAccessClaims>(token);
      if (claims.typ !== 'mobile_access' || !claims.sub || !claims.tid || !claims.sid) return null;
      return claims;
    } catch {
      return null;
    }
  }
}
