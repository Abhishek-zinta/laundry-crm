import { parseEnv } from '../src/config/env';

const DB = 'postgresql://u:p@localhost:5432/db';
const STRONG = 'Zq3+8mVf0pX7kL2yR9tW4nB6cH1jD5sG/aE0uIoQ'; // test-only value

describe('environment validation', () => {
  it('lets development run without a mobile secret', () => {
    expect(parseEnv({ DATABASE_URL: DB }).MOBILE_JWT_SECRET).toBeUndefined();
  });

  it('requires DATABASE_URL', () => {
    expect(() => parseEnv({ NODE_ENV: 'production', MOBILE_JWT_SECRET: STRONG })).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['missing', undefined, /required in production/],
    ['empty', '', /required in production/],
    ['too short', 'short-secret', /at least 32 characters/],
    ['the committed dev value', 'rinseops-dev-only-mobile-jwt-secret-not-for-production', /public development value/],
    ['low entropy', 'a'.repeat(48), /too weak/],
  ])('refuses to start in production when the mobile secret is %s', (_label, secret, error) => {
    expect(() => parseEnv({ NODE_ENV: 'production', DATABASE_URL: DB, MOBILE_JWT_SECRET: secret })).toThrow(error);
  });

  it('treats an HTTPS deployment (COOKIE_SECURE=true) as production even if NODE_ENV is forgotten', () => {
    expect(() => parseEnv({ DATABASE_URL: DB, COOKIE_SECURE: 'true' })).toThrow(/required when COOKIE_SECURE=true/);
    expect(parseEnv({ DATABASE_URL: DB, COOKIE_SECURE: 'true', MOBILE_JWT_SECRET: STRONG }).COOKIE_SECURE).toBe(true);
  });

  it('accepts a strong random secret in production', () => {
    const e = parseEnv({ NODE_ENV: 'production', DATABASE_URL: DB, MOBILE_JWT_SECRET: STRONG, TRUST_PROXY: '1' });
    expect(e.NODE_ENV).toBe('production');
    expect(e.TRUST_PROXY).toBe('1');
  });

  it('defaults TRUST_PROXY to loopback', () => {
    expect(parseEnv({ DATABASE_URL: DB }).TRUST_PROXY).toBe('loopback');
  });
});
