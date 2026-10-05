import { Logger } from '@nestjs/common';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /**
   * Express "trust proxy": which reverse proxies may set X-Forwarded-For.
   * "loopback" (default), a hop count ("1"), comma-separated IPs/CIDRs, or "true"/"false".
   * Client IPs drive login rate limiting and audit logs, so this must match the deployment.
   */
  TRUST_PROXY: z.string().trim().min(1).default('loopback'),
  /** Signs native-app access tokens. Required (32+ chars) in production. */
  MOBILE_JWT_SECRET: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(32, 'MOBILE_JWT_SECRET must be at least 32 characters').optional(),
  ),
  MOBILE_ACCESS_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  MOBILE_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
});

/** Development/test only. Committed to the repo, so never acceptable for a deployment. */
const DEV_MOBILE_JWT_SECRET = 'rinseops-dev-only-mobile-jwt-secret-not-for-production';

/** A random secret (e.g. `openssl rand -base64 48`) easily clears this; "aaaa…" does not. */
const MIN_SECRET_DISTINCT_CHARS = 16;

export type Env = z.infer<typeof envSchema>;

/**
 * A deployment that is reachable over HTTPS: explicitly production, or serving
 * Secure cookies. Such a deployment must never fall back to the dev secret,
 * even if NODE_ENV was forgotten.
 */
function isDeployed(e: Env): boolean {
  return e.NODE_ENV === 'production' || e.COOKIE_SECURE;
}

/** Validates a raw environment. Throws with every problem listed. Pure, for tests. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  if (isDeployed(e)) {
    const why = e.NODE_ENV === 'production' ? 'in production' : 'when COOKIE_SECURE=true';
    const secret = e.MOBILE_JWT_SECRET;
    if (!secret) {
      throw new Error(`Invalid environment configuration: MOBILE_JWT_SECRET is required ${why}`);
    }
    if (secret === DEV_MOBILE_JWT_SECRET) {
      throw new Error(`Invalid environment configuration: MOBILE_JWT_SECRET is the public development value; generate a new one`);
    }
    if (new Set(secret).size < MIN_SECRET_DISTINCT_CHARS) {
      throw new Error(
        `Invalid environment configuration: MOBILE_JWT_SECRET is too weak (generate one with \`openssl rand -base64 48\`)`,
      );
    }
  }
  return e;
}

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
    if (!cached.MOBILE_JWT_SECRET && cached.NODE_ENV === 'development') {
      new Logger('Config').warn('MOBILE_JWT_SECRET is not set: using the development-only signing secret');
    }
    if (cached.NODE_ENV === 'production' && !cached.COOKIE_SECURE) {
      new Logger('Config').warn('COOKIE_SECURE is false in production: web session cookies will not be marked Secure');
    }
  }
  return cached;
}

export function mobileJwtSecret(): string {
  return env().MOBILE_JWT_SECRET ?? DEV_MOBILE_JWT_SECRET;
}

export function allowedOrigins(): string[] {
  return env()
    .WEB_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** TRUST_PROXY as Express expects it: boolean, hop count, or address list. */
export function trustProxySetting(): boolean | number | string {
  const v = env().TRUST_PROXY;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

export const SESSION_COOKIE = 'ro_session';
