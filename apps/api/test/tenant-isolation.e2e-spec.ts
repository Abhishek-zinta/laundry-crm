import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTenantClient } from '../src/common/prisma/tenant-extension';
import { createApp, inTwoDays, login, posLine, resetDatabase, seedTenant, TestTenant } from './helpers';

describe('Tenant isolation', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let a: TestTenant;
  let b: TestTenant;
  let ownerA: request.Agent;
  let ownerB: request.Agent;
  let orderA: { id: string; orderNumber: string; customer: { id: string }; garments: Array<{ tagCode: string; id: string }>; payments: Array<{ id: string }> };

  beforeAll(async () => {
    prisma = new PrismaClient();
    await resetDatabase(prisma);
    a = await seedTenant(prisma, 'a');
    b = await seedTenant(prisma, 'b');
    app = await createApp();
    ownerA = await login(app, a.emails.owner);
    ownerB = await login(app, b.emails.owner);

    const customer = await ownerA.post('/api/v1/customers').send({ firstName: 'Alice', phone: '9111100001' }).expect(201);
    const line = { ...(await posLine(ownerA, a.storeId, 'Dry Cleaning', 'Shirt')), quantity: '2' };
    orderA = (
      await ownerA
        .post('/api/v1/orders')
        .send({ customerId: customer.body.id, storeId: a.storeId, lines: [line], dueDate: inTwoDays(), payments: [{ method: 'CASH', amount: '100' }] })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('hides tenant A records from tenant B by id', async () => {
    await ownerB.get(`/api/v1/orders/${orderA.id}`).expect(404);
    await ownerB.get(`/api/v1/customers/${orderA.customer.id}`).expect(404);
    await ownerB.get(`/api/v1/garments/${orderA.garments[0]!.id}`).expect(404);
  });

  it('excludes tenant A data from tenant B lists and search', async () => {
    const orders = (await ownerB.get('/api/v1/orders').expect(200)).body;
    expect(orders.total).toBe(0);
    const customers = (await ownerB.get('/api/v1/customers').expect(200)).body;
    expect(customers.total).toBe(0);
    const search = (await ownerB.get(`/api/v1/search?q=${orderA.orderNumber}`).expect(200)).body;
    expect(search.orders).toHaveLength(0);
    const byTag = (await ownerB.get(`/api/v1/search?q=${orderA.garments[0]!.tagCode}`).expect(200)).body;
    expect(byTag.garments).toHaveLength(0);
    const payments = (await ownerB.get('/api/v1/payments').expect(200)).body;
    expect(payments.total).toBe(0);
  });

  it('prevents tenant B from mutating tenant A records', async () => {
    await ownerB.post(`/api/v1/orders/${orderA.id}/status`).send({ status: 'PROCESSING' }).expect(404);
    await ownerB.post('/api/v1/payments').send({ orderId: orderA.id, amount: '10', method: 'CASH' }).expect(404);
    await ownerB.post(`/api/v1/payments/${orderA.payments[0]!.id}/refund`).send({ reason: 'steal' }).expect(404);
    await ownerB.patch(`/api/v1/customers/${orderA.customer.id}`).send({ firstName: 'Mallory' }).expect(404);
    // Creating an order for another tenant's customer or store is refused.
    await ownerB
      .post('/api/v1/orders')
      .send({ customerId: orderA.customer.id, storeId: b.storeId, lines: [], dueDate: inTwoDays() })
      .expect(400);
    const line = { ...(await posLine(ownerB, b.storeId, 'Dry Cleaning', 'Shirt')), quantity: '1' };
    await ownerB.post('/api/v1/orders').send({ customerId: orderA.customer.id, storeId: b.storeId, lines: [line], dueDate: inTwoDays() }).expect(404);
    await ownerB.post('/api/v1/orders').send({ customerId: orderA.customer.id, storeId: a.storeId, lines: [line], dueDate: inTwoDays() }).expect(404);

    const unchanged = (await ownerA.get(`/api/v1/orders/${orderA.id}`).expect(200)).body;
    expect(unchanged.status).toBe('RECEIVED');
    expect(unchanged.paidAmount).toBe('100.00');
  });

  it('scopes every query of the tenant Prisma client automatically', async () => {
    const dbB = createTenantClient(prisma, b.tenantId);
    expect(await dbB.order.findFirst({ where: { id: orderA.id } })).toBeNull();
    expect(await dbB.order.count()).toBe(0);
    const updated = await dbB.order.updateMany({ where: { id: orderA.id }, data: { notes: 'hijack' } });
    expect(updated.count).toBe(0);

    // Creates are stamped with the scoped tenant even if another id is passed.
    const created = await dbB.auditLog.create({
      data: { tenantId: a.tenantId, action: 'TEST', entityType: 'Test' },
    });
    expect(created.tenantId).toBe(b.tenantId);

    const dbA = createTenantClient(prisma, a.tenantId);
    expect(await dbA.order.count()).toBe(1);
  });

  it('keeps sessions bound to their tenant (deactivated users are signed out)', async () => {
    const counterA = await login(app, a.emails.counter);
    await counterA.get('/api/v1/orders').expect(200);
    const staff = (await ownerA.get('/api/v1/staff').expect(200)).body as Array<{ id: string; email: string }>;
    const target = staff.find((s) => s.email === a.emails.counter)!;
    // Tenant B's owner cannot touch tenant A's staff.
    await ownerB.patch(`/api/v1/staff/${target.id}`).send({ status: 'INACTIVE' }).expect(404);
    await ownerA.patch(`/api/v1/staff/${target.id}`).send({ status: 'INACTIVE' }).expect(200);
    await counterA.get('/api/v1/orders').expect(401);
  });
});
