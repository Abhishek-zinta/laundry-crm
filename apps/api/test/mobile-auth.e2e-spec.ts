import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp, inTwoDays, login, PASSWORD, resetDatabase, seedTenant, TestTenant } from './helpers';

interface TokenPair {
  tokenType: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

describe('Mobile (native app) authentication', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let a: TestTenant;
  let b: TestTenant;
  let http: ReturnType<typeof request>;

  const mobileLogin = (email: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/mobile/auth/login').send({ email, password, deviceName: 'Test device' });
  const refresh = (refreshToken: string) => request(app.getHttpServer()).post('/api/v1/mobile/auth/refresh').send({ refreshToken });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    prisma = new PrismaClient();
    await resetDatabase(prisma);
    a = await seedTenant(prisma, 'ma');
    b = await seedTenant(prisma, 'mb');
    app = await createApp();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('logs in with a short-lived access token and a refresh token, without setting cookies', async () => {
    const res = await mobileLogin(a.emails.counter).expect(200);
    const pair = res.body as TokenPair;
    expect(pair.tokenType).toBe('Bearer');
    expect(pair.expiresIn).toBe(15 * 60);
    expect(pair.accessToken.split('.')).toHaveLength(3);
    expect(pair.refreshToken.length).toBeGreaterThan(30);
    expect(res.headers['set-cookie']).toBeUndefined();

    const me = await http.get('/api/v1/auth/me').set(bearer(pair.accessToken)).expect(200);
    expect(me.body.user.email).toBe(a.emails.counter);
    expect(me.body.tenant.id).toBe(a.tenantId);

    // Only a hash of the refresh token is stored.
    const stored = await prisma.mobileSession.findMany({ where: { userId: me.body.user.id } });
    expect(stored.some((s) => s.refreshTokenHash === pair.refreshToken)).toBe(false);
  });

  it('serves the session profile at /mobile/auth/me for bearer tokens only', async () => {
    const { accessToken } = (await mobileLogin(a.emails.counter).expect(200)).body as TokenPair;
    const me = await http.get('/api/v1/mobile/auth/me').set(bearer(accessToken)).expect(200);
    expect(me.body.user.email).toBe(a.emails.counter);
    expect(me.body.tenant.id).toBe(a.tenantId);
    expect(Array.isArray(me.body.permissions)).toBe(true);
    await http.get('/api/v1/mobile/auth/me').expect(401);
    await http.get('/api/v1/mobile/auth/me').set(bearer('not-a-jwt')).expect(401);
  });

  it('rejects bad credentials, missing, malformed and forged tokens', async () => {
    expect((await mobileLogin(a.emails.counter, 'wrong-password').expect(401)).body.error.code).toBe('INVALID_CREDENTIALS');
    await http.get('/api/v1/auth/me').expect(401);
    await http.get('/api/v1/auth/me').set(bearer('not-a-jwt')).expect(401);
    const { accessToken, refreshToken } = (await mobileLogin(a.emails.counter).expect(200)).body as TokenPair;
    const [h, p] = accessToken.split('.');
    await http.get('/api/v1/auth/me').set(bearer(`${h}.${p}.forgedsignature`)).expect(401);
    // A refresh token is not an access token.
    await http.get('/api/v1/auth/me').set(bearer(refreshToken)).expect(401);
  });

  it('rotates refresh tokens and detects reuse of an old one', async () => {
    const first = (await mobileLogin(a.emails.counter).expect(200)).body as TokenPair;
    const second = (await refresh(first.refreshToken).expect(200)).body as TokenPair;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);
    await http.get('/api/v1/auth/me').set(bearer(second.accessToken)).expect(200);

    // Replaying the rotated token revokes the whole family, including the newest tokens.
    expect((await refresh(first.refreshToken).expect(401)).body.error.code).toBe('INVALID_REFRESH_TOKEN');
    await refresh(second.refreshToken).expect(401);
    await http.get('/api/v1/auth/me').set(bearer(second.accessToken)).expect(401);
    await http.get('/api/v1/auth/me').set(bearer(first.accessToken)).expect(401);
  });

  it('allows only one of two concurrent refreshes with the same token', async () => {
    const pair = (await mobileLogin(a.emails.counter).expect(200)).body as TokenPair;
    const results = await Promise.all([refresh(pair.refreshToken), refresh(pair.refreshToken)]);
    expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1);
  });

  it('logout revokes the session server-side immediately', async () => {
    const pair = (await mobileLogin(a.emails.counter).expect(200)).body as TokenPair;
    await http.post('/api/v1/mobile/auth/logout').send({ refreshToken: pair.refreshToken }).expect(200);
    await http.get('/api/v1/auth/me').set(bearer(pair.accessToken)).expect(401);
    await refresh(pair.refreshToken).expect(401);
    // Logging out twice is harmless.
    await http.post('/api/v1/mobile/auth/logout').send({ refreshToken: pair.refreshToken }).expect(200);
  });

  it('cuts off a deactivated user immediately, for access and refresh', async () => {
    const pair = (await mobileLogin(a.emails.processing).expect(200)).body as TokenPair;
    await http.get('/api/v1/garments').set(bearer(pair.accessToken)).expect(200);

    const owner = await login(app, a.emails.owner);
    const staff = (await owner.get('/api/v1/staff').expect(200)).body as Array<{ id: string; email: string }>;
    const target = staff.find((s) => s.email === a.emails.processing)!;
    await owner.patch(`/api/v1/staff/${target.id}`).send({ status: 'INACTIVE' }).expect(200);

    await http.get('/api/v1/garments').set(bearer(pair.accessToken)).expect(401);
    await refresh(pair.refreshToken).expect(401);
    expect((await mobileLogin(a.emails.processing).expect(403)).body.error.code).toBe('ACCOUNT_INACTIVE');

    await owner.patch(`/api/v1/staff/${target.id}`).send({ status: 'ACTIVE' }).expect(200);
  });

  it('still enforces permissions and tenant isolation for bearer tokens', async () => {
    const driver = (await mobileLogin(a.emails.driver).expect(200)).body as TokenPair;
    await http.get('/api/v1/orders').set(bearer(driver.accessToken)).expect(403);
    await http.get('/api/v1/tasks/mine').set(bearer(driver.accessToken)).expect(200);

    const ownerA = (await mobileLogin(a.emails.owner).expect(200)).body as TokenPair;
    const ownerB = (await mobileLogin(b.emails.owner).expect(200)).body as TokenPair;
    const customer = await http
      .post('/api/v1/customers')
      .set(bearer(ownerA.accessToken))
      .send({ firstName: 'Mobile', phone: '9333300001' })
      .expect(201);
    const pos = await http.get(`/api/v1/catalog/pos?storeId=${a.storeId}`).set(bearer(ownerA.accessToken)).expect(200);
    const dc = pos.body.categories.find((c: { name: string }) => c.name === 'Dry Cleaning');
    const shirt = dc.items.find((i: { name: string }) => i.name === 'Shirt');
    const line = { serviceCategoryId: dc.id, serviceItemId: shirt.serviceItemId, quantity: '2' };
    const order = await http
      .post('/api/v1/orders')
      .set(bearer(ownerA.accessToken))
      .send({ customerId: customer.body.id, storeId: a.storeId, lines: [line], dueDate: inTwoDays(), payments: [{ method: 'CASH', amount: '50' }] })
      .expect(201);

    await http.get(`/api/v1/orders/${order.body.id}`).set(bearer(ownerB.accessToken)).expect(404);
    await http.get(`/api/v1/customers/${customer.body.id}`).set(bearer(ownerB.accessToken)).expect(404);
    const list = await http.get('/api/v1/orders').set(bearer(ownerB.accessToken)).expect(200);
    expect(list.body.total).toBe(0);
  });

  it('leaves the web cookie login and CSRF protection unchanged', async () => {
    const web = await login(app, a.emails.counter);
    await web.get('/api/v1/auth/me').expect(200);
    const blocked = await web
      .post('/api/v1/customers')
      .set('Origin', 'https://evil.example')
      .send({ firstName: 'X', phone: '9000000077' })
      .expect(403);
    expect(blocked.body.error.code).toBe('CSRF_REJECTED');
  });
});
