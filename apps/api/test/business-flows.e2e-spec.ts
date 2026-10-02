import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp, inTwoDays, login, posLine, resetDatabase, seedTenant, TestTenant } from './helpers';

/**
 * End-to-end business rules over HTTP against a real PostgreSQL database:
 * order creation, totals, partial payments, workflow, racks and permissions.
 */
describe('RinseOps business flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let t: TestTenant;
  let counter: request.Agent;
  let processing: request.Agent;
  let owner: request.Agent;
  let driver: request.Agent;
  let customerId: string;
  let lines: Array<{ serviceCategoryId: string; serviceItemId: string; quantity: string }>;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await resetDatabase(prisma);
    t = await seedTenant(prisma, 'flows');
    app = await createApp();
    counter = await login(app, t.emails.counter);
    processing = await login(app, t.emails.processing);
    owner = await login(app, t.emails.owner);
    driver = await login(app, t.emails.driver);

    const c = await counter.post('/api/v1/customers').send({ firstName: 'Walk', lastName: 'In', phone: '9876500001' }).expect(201);
    customerId = c.body.id;
    lines = [
      { ...(await posLine(counter, t.storeId, 'Dry Cleaning', 'Shirt')), quantity: '3' },
      { ...(await posLine(counter, t.storeId, 'Dry Cleaning', 'Trouser')), quantity: '2' },
      { ...(await posLine(counter, t.storeId, 'Wash & Fold', 'Blanket')), quantity: '1' },
    ];
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const newOrder = (body: Record<string, unknown> = {}) =>
    counter.post('/api/v1/orders').send({ customerId, storeId: t.storeId, lines, dueDate: inTwoDays(), ...body });

  it('rejects duplicate customer phone numbers', async () => {
    const res = await counter.post('/api/v1/customers').send({ firstName: 'Dup', phone: '9876500001' }).expect(409);
    expect(res.body.error.code).toBe('DUPLICATE_PHONE');
  });

  it('creates an order with server-side totals, garments, history and payment in one transaction', async () => {
    const res = await newOrder({ payments: [{ method: 'CASH', amount: '500' }] }).expect(201);
    const o = res.body;
    // 3×120 + 2×150 + 1×350 = 1010; GST 18% = 181.80
    expect(o.subtotal).toBe('1010.00');
    expect(o.taxAmount).toBe('181.80');
    expect(o.grandTotal).toBe('1191.80');
    expect(o.paidAmount).toBe('500.00');
    expect(o.balanceDue).toBe('691.80');
    expect(o.paymentStatus).toBe('PARTIAL');
    expect(o.orderNumber).toMatch(/^RO-\d{4}-\d{6}$/);
    expect(o.garments).toHaveLength(6);
    expect(new Set(o.garments.map((g: { tagCode: string }) => g.tagCode)).size).toBe(6);
    expect(o.statusHistory).toHaveLength(1);
    expect(o.statusHistory[0].toStatus).toBe('RECEIVED');
  });

  it('generates sequential human-readable order numbers', async () => {
    const a = (await newOrder().expect(201)).body.orderNumber as string;
    const b = (await newOrder().expect(201)).body.orderNumber as string;
    expect(Number(b.split('-')[2])).toBe(Number(a.split('-')[2]) + 1);
  });

  it('is idempotent for repeated submissions with the same key', async () => {
    const key = `test-${Date.now()}`;
    const first = (await newOrder({ idempotencyKey: key }).expect(201)).body;
    const second = (await newOrder({ idempotencyKey: key }).expect(201)).body;
    expect(second.id).toBe(first.id);
  });

  it('rejects payments larger than the order total', async () => {
    const res = await newOrder({ payments: [{ method: 'CASH', amount: '5000' }] }).expect(422);
    expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_TOTAL');
  });

  it('tracks partial payments in the ledger until the balance is zero', async () => {
    const order = (await newOrder().expect(201)).body;
    await counter.post('/api/v1/payments').send({ orderId: order.id, amount: '300', method: 'CASH' }).expect(201);
    const p2 = await counter.post('/api/v1/payments').send({ orderId: order.id, amount: '500', method: 'UPI' }).expect(201);
    expect(p2.body.order.paidAmount).toBe('800.00');
    expect(p2.body.order.balanceDue).toBe('391.80');
    expect(p2.body.order.paymentStatus).toBe('PARTIAL');

    const over = await counter.post('/api/v1/payments').send({ orderId: order.id, amount: '400', method: 'UPI' }).expect(422);
    expect(over.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');

    const last = await counter.post('/api/v1/payments').send({ orderId: order.id, amount: '391.80', method: 'CARD' }).expect(201);
    expect(last.body.order.balanceDue).toBe('0.00');
    expect(last.body.order.paymentStatus).toBe('PAID');
  });

  it('recomputes the balance when a payment is refunded (owner only)', async () => {
    const order = (await newOrder({ payments: [{ method: 'CASH', amount: '1191.80' }] }).expect(201)).body;
    const paymentId = order.payments[0].id;
    const denied = await counter.post(`/api/v1/payments/${paymentId}/refund`).send({ reason: 'test refund' }).expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    await owner.post(`/api/v1/payments/${paymentId}/refund`).send({ reason: 'Customer complaint' }).expect(200);
    const after = (await owner.get(`/api/v1/orders/${order.id}`).expect(200)).body;
    expect(after.paidAmount).toBe('0.00');
    expect(after.balanceDue).toBe('1191.80');
    expect(after.payments[0].status).toBe('REFUNDED');
  });

  it('enforces the workflow and records every status change', async () => {
    const order = (await newOrder().expect(201)).body;
    const invalid = await processing.post(`/api/v1/orders/${order.id}/status`).send({ status: 'READY' }).expect(422);
    expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    for (const status of ['PROCESSING', 'QUALITY_CHECK', 'READY']) {
      await processing.post(`/api/v1/orders/${order.id}/status`).send({ status }).expect(200);
    }
    const ready = (await counter.get(`/api/v1/orders/${order.id}`).expect(200)).body;
    expect(ready.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual(['RECEIVED', 'PROCESSING', 'QUALITY_CHECK', 'READY']);
    expect(ready.garments.every((g: { status: string }) => g.status === 'READY')).toBe(true);

    // Processing staff cannot hand orders over; counter staff cannot deliver with a balance.
    await processing.post(`/api/v1/orders/${order.id}/status`).send({ status: 'DELIVERED' }).expect(403);
    const owing = await counter.post(`/api/v1/orders/${order.id}/status`).send({ status: 'DELIVERED' }).expect(422);
    expect(owing.body.error.code).toBe('OUTSTANDING_BALANCE');
    await counter.post(`/api/v1/orders/${order.id}/status`).send({ status: 'DELIVERED', allowOutstanding: true }).expect(403);

    await counter.post('/api/v1/payments').send({ orderId: order.id, amount: ready.balanceDue, method: 'UPI' }).expect(201);
    const delivered = (await counter.post(`/api/v1/orders/${order.id}/status`).send({ status: 'DELIVERED' }).expect(200)).body;
    expect(delivered.status).toBe('DELIVERED');

    const again = await owner.post(`/api/v1/orders/${order.id}/cancel`).send({ reason: 'too late' }).expect(422);
    expect(again.body.error.code).toBe('ORDER_ALREADY_DELIVERED');
  });

  it('advances the order automatically when every garment reaches the next stage', async () => {
    const order = (await newOrder().expect(201)).body;
    await processing.post(`/api/v1/orders/${order.id}/status`).send({ status: 'PROCESSING' }).expect(200);
    const tags = order.garments.map((g: { tagCode: string }) => g.tagCode);
    const bulk = await processing.post('/api/v1/garments/bulk-status').send({ tagCodes: tags, status: 'QUALITY_CHECK' }).expect(200);
    expect(bulk.body.updated).toBe(tags.length);
    const after = (await processing.get(`/api/v1/orders/${order.id}`).expect(200)).body;
    expect(after.status).toBe('QUALITY_CHECK');
  });

  it('blocks cancelling an order that still holds payments', async () => {
    const order = (await newOrder({ payments: [{ method: 'CASH', amount: '100' }] }).expect(201)).body;
    const res = await owner.post(`/api/v1/orders/${order.id}/cancel`).send({ reason: 'customer left' }).expect(422);
    expect(res.body.error.code).toBe('ORDER_HAS_PAYMENTS');
  });

  it('assigns, moves and releases rack slots with capacity checks', async () => {
    const makeReady = async () => {
      const o = (await newOrder().expect(201)).body;
      for (const status of ['PROCESSING', 'QUALITY_CHECK', 'READY']) {
        await processing.post(`/api/v1/orders/${o.id}/status`).send({ status }).expect(200);
      }
      return o;
    };
    const board = (await counter.get(`/api/v1/racks?storeId=${t.storeId}`).expect(200)).body;
    const [a01, a02] = board.racks[0].slots;

    const notReady = (await newOrder().expect(201)).body;
    const early = await counter.post(`/api/v1/orders/${notReady.id}/rack`).send({ rackSlotId: a01.id }).expect(422);
    expect(early.body.error.code).toBe('RACK_ORDER_NOT_READY');

    const first = await makeReady();
    const second = await makeReady();
    await counter.post(`/api/v1/orders/${first.id}/rack`).send({ rackSlotId: a01.id }).expect(201);
    const full = await counter.post(`/api/v1/orders/${second.id}/rack`).send({ rackSlotId: a01.id }).expect(409);
    expect(full.body.error.code).toBe('RACK_SLOT_FULL');

    await counter.post(`/api/v1/orders/${first.id}/rack`).send({ rackSlotId: a02.id }).expect(201);
    const moved = (await counter.get(`/api/v1/orders/${first.id}`).expect(200)).body;
    expect(moved.rack.slotCode).toBe(a02.code);
    expect(moved.rackHistory).toHaveLength(2);

    // Slot A01 is free again after the move, so the second order fits.
    await counter.post(`/api/v1/orders/${second.id}/rack`).send({ rackSlotId: a01.id }).expect(201);

    // Delivering releases the slot.
    await counter.post('/api/v1/payments').send({ orderId: first.id, amount: moved.balanceDue, method: 'CASH' }).expect(201);
    await counter.post(`/api/v1/orders/${first.id}/status`).send({ status: 'DELIVERED' }).expect(200);
    const after = (await counter.get(`/api/v1/racks?storeId=${t.storeId}`).expect(200)).body;
    expect(after.racks[0].slots.find((s: { id: string }) => s.id === a02.id).available).toBe(true);
  });

  it('finds orders by phone, order number and garment tag', async () => {
    const order = (await newOrder().expect(201)).body;
    const byPhone = (await counter.get('/api/v1/search?q=9876500001').expect(200)).body;
    expect(byPhone.customers[0].id).toBe(customerId);
    expect(byPhone.orders.some((o: { id: string }) => o.id === order.id)).toBe(true);
    const byNumber = (await counter.get(`/api/v1/search?q=${order.orderNumber}`).expect(200)).body;
    expect(byNumber.orders[0].id).toBe(order.id);
    const byTag = (await counter.get(`/api/v1/search?q=${order.garments[0].tagCode}`).expect(200)).body;
    expect(byTag.garments[0].tagCode).toBe(order.garments[0].tagCode);
    expect(byTag.orders[0].id).toBe(order.id);
  });

  it('checks permissions on the server, not just in the UI', async () => {
    await driver.get('/api/v1/orders').expect(403);
    await driver.get('/api/v1/customers').expect(403);
    await counter.get('/api/v1/reports/sales').expect(403);
    await counter.get('/api/v1/dashboard').expect(403);
    await counter.patch('/api/v1/settings').send({ taxRate: '0' }).expect(403);
    await processing.post('/api/v1/payments').send({ orderId: '00000000-0000-4000-8000-000000000000', amount: '1', method: 'CASH' }).expect(403);
    await request(app.getHttpServer()).get('/api/v1/orders').expect(401);
    await owner.get('/api/v1/reports/sales?preset=today').expect(200);
  });

  it('rejects state-changing requests from other origins (CSRF)', async () => {
    const res = await counter
      .post('/api/v1/customers')
      .set('Origin', 'https://evil.example')
      .send({ firstName: 'X', phone: '9000000099' })
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });
});
