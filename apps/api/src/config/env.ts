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
  /** Signs native-app access tokens. Required (32+ chars) in production. */
  MOBILE_JWT_SECRET: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(32, 'MOBILE_JWT_SECRET must be at least 32 characters').optional(),
  ),
  MOBILE_ACCESS_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  MOBILE_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
});

/** Development/test only. Production refuses to start without MOBILE_JWT_SECRET. */
const DEV_MOBILE_JWT_SECRET = 'rinseops-dev-only-mobile-jwt-secret-not-for-production';

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid environment configuration: ${issues}`);
    }
    if (parsed.data.NODE_ENV === 'production' && !parsed.data.MOBILE_JWT_SECRET) {
      throw new Error('Invalid environment configuration: MOBILE_JWT_SECRET is required in production');
    }
    cached = parsed.data;
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

export const SESSION_COOKIE = 'ro_session';
