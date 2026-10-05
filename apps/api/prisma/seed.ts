/**
 * Demo seed: "FreshFold Laundry" with two stores, staff for every role,
 * realistic customers, orders across every workflow stage, payments,
 * garments, rack assignments and pickup/delivery tasks.
 *
 * Re-running the seed deletes and recreates the demo tenant only.
 *
 *   npm run db:seed
 */
import { Prisma, PrismaClient } from '@prisma/client';
import {
  addDaysToKey,
  calculateOrderTotals,
  dateKeyInZone,
  derivePaymentStatus,
  formatOrderNumber,
  formatTagCode,
  garmentUnitsForLine,
  GarmentIssue,
  OrderStatus,
  outstandingAmount,
  PaymentMethod,
  priceModifier,
  roundMoney,
  sumMoney,
  toDecimal,
  zonedTimeToUtc,
} from '@rinseops/shared';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { createRackWithSlots, provisionTenant } from '../src/modules/tenants/tenant-provisioning';

const prisma = new PrismaClient();

const SLUG = 'freshfold';
const TZ = 'Asia/Kolkata';
const PASSWORD = 'Password123!';
const DEMO_EMAILS = [
  'owner@freshfold.test',
  'manager@freshfold.test',
  'counter@freshfold.test',
  'counter.central@freshfold.test',
  'processing@freshfold.test',
  'driver@freshfold.test',
];

// Deterministic PRNG so the demo data is the same on every machine.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260402);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const CUSTOMERS: Array<[string, string, string, string]> = [
  ['Priya', 'Sharma', '9876543210', 'Koramangala 5th Block'],
  ['Arjun', 'Reddy', '9845012345', 'Indiranagar 100 Ft Road'],
  ['Sneha', 'Iyer', '9900123456', 'HSR Layout Sector 2'],
  ['Rahul', 'Verma', '9811223344', 'Jayanagar 4th Block'],
  ['Ananya', 'Krishnan', '9886677889', 'Whitefield Main Road'],
  ['Vikram', 'Malhotra', '9820098765', 'MG Road, Brigade Towers'],
  ['Neha', 'Gupta', '9731234567', 'BTM Layout 2nd Stage'],
  ['Karthik', 'Subramanian', '9741122334', 'Malleshwaram 8th Cross'],
  ['Divya', 'Menon', '9008765432', 'Sadashivanagar'],
  ['Amit', 'Patel', '9823456781', 'Electronic City Phase 1'],
  ['Pooja', 'Nair', '9945678123', 'Bellandur Outer Ring Road'],
  ['Siddharth', 'Joshi', '9663321456', 'Basavanagudi'],
  ['Meera', 'Pillai', '9886012347', 'Frazer Town'],
  ['Rohit', 'Kapoor', '9972345610', 'Hebbal Kempapura'],
  ['Lakshmi', 'Rao', '9844556677', 'Rajajinagar 2nd Block'],
  ['Farhan', 'Sheikh', '9739988776', 'Richmond Town'],
  ['Ishita', 'Banerjee', '9916655443', 'Domlur Layout'],
  ['Naveen', 'Kumar', '9880011223', 'Yelahanka New Town'],
  ['Kavitha', 'Srinivasan', '9535123987', 'JP Nagar 6th Phase'],
  ['Aditya', 'Deshmukh', '9632587410', 'Marathahalli'],
  ['Shreya', 'Ghosh', '9008123459', 'Banashankari 3rd Stage'],
  ['Manoj', 'Hegde', '9449012876', 'Vijayanagar'],
  ['Tanvi', 'Agarwal', '9740345612', 'Sarjapur Road'],
  ['Deepak', 'Chauhan', '9900987123', 'Cunningham Road'],
];

const COLORS = ['White', 'Light blue', 'Navy', 'Black', 'Grey', 'Beige', 'Maroon', 'Olive', 'Pink', 'Cream', 'Striped', 'Checked'];
const BRANDS = ['Van Heusen', 'Allen Solly', 'Raymond', 'Fabindia', 'Zara', 'H&M', 'Peter England', 'Manyavar', null, null, null];
const FABRICS = ['Cotton', 'Linen', 'Silk', 'Wool', 'Polyester', 'Denim', null, null];

type Basket = Array<{ item: string; category: string; qty: string }>;
const BASKETS: Basket[] = [
  [
    { item: 'T-Shirt', category: 'WI', qty: '4' },
    { item: 'Jeans', category: 'WF', qty: '2' },
  ],
  [{ item: 'Dress', category: 'DC', qty: '2' }],
  [
    { item: 'Sneakers', category: 'SC', qty: '1' },
    { item: 'Cap', category: 'SC', qty: '1' },
  ],
  [
    { item: 'Trouser', category: 'ALT', qty: '2' },
    { item: 'Saree', category: 'ALT', qty: '1' },
  ],
  [
    { item: 'Sweater / Hoodie', category: 'WF', qty: '2' },
    { item: 'Towel', category: 'WF', qty: '4' },
  ],
  [
    { item: 'Shirt', category: 'DC', qty: '3' },
    { item: 'Trouser', category: 'DC', qty: '2' },
  ],
  [{ item: 'Laundry (by kg)', category: 'WF', qty: '4.5' }],
  [
    { item: 'Saree', category: 'DC', qty: '2' },
    { item: 'Kurta', category: 'WI', qty: '3' },
  ],
  [{ item: 'Suit (2 pc)', category: 'DC', qty: '1' }],
  [
    { item: 'Shirt', category: 'WI', qty: '6' },
    { item: 'Trouser', category: 'WI', qty: '4' },
  ],
  [
    { item: 'Blanket', category: 'WF', qty: '1' },
    { item: 'Bedsheet', category: 'WF', qty: '2' },
  ],
  [{ item: 'Curtains', category: 'DC', qty: '4' }],
  [{ item: 'Shoes', category: 'SC', qty: '1' }],
  [
    { item: 'Jacket', category: 'DC', qty: '1' },
    { item: 'Shirt', category: 'SI', qty: '5' },
  ],
  [
    { item: 'Laundry (by kg)', category: 'WI', qty: '3.2' },
    { item: 'Bedsheet', category: 'WI', qty: '1' },
  ],
  [
    { item: 'Shirt', category: 'DC', qty: '3' },
    { item: 'Trouser', category: 'DC', qty: '2' },
    { item: 'Blanket', category: 'WF', qty: '1' },
  ],
];

async function main() {
  // Demo accounts use a published password: never create them on a real deployment.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data with NODE_ENV=production.');
  }
  console.log('Seeding RinseOps demo data…');
  await prisma.tenant.deleteMany({ where: { slug: SLUG } });
  await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });

  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // --- Tenant, stores, staff -----------------------------------------------
  const {
    tenant,
    store: downtown,
    owner,
  } = await prisma.$transaction(
    (tx) =>
      provisionTenant(tx, {
        businessName: 'FreshFold Laundry',
        slug: SLUG,
        ownerName: 'Aarav Mehta',
        ownerEmail: 'owner@freshfold.test',
        ownerPhone: '+919900000001',
        passwordHash,
        storeName: 'Downtown Store',
        storeCode: 'DT',
        currency: 'INR',
        timezone: TZ,
        locale: 'en-IN',
        taxRate: '18',
        starterRacks: false,
      }),
    { timeout: 30000 },
  );
  const tenantId = tenant.id;
  const db = prisma;

  await db.tenant.update({
    where: { id: tenantId },
    data: { address: '12, 80 Feet Road, Koramangala, Bengaluru 560034', phone: '+918041234567', email: 'hello@freshfold.test' },
  });
  await db.store.update({
    where: { id: downtown.id },
    data: { phone: '+918041234567', address: '12, 80 Feet Road, Koramangala, Bengaluru 560034' },
  });
  await db.tenantSettings.update({ where: { tenantId }, data: { taxNumber: '29ABCDE1234F1Z5', defaultTurnaroundHours: 48 } });

  const central = await db.store.create({
    data: { tenantId, name: 'Central Store', code: 'CT', phone: '+918049876543', address: '44, Residency Road, Bengaluru 560025' },
  });

  const mkUser = (
    name: string,
    email: string,
    phone: string,
    role: 'MANAGER' | 'COUNTER_STAFF' | 'PROCESSING_STAFF' | 'DRIVER',
    storeIds: string[],
  ) =>
    db.user.create({
      data: { tenantId, name, email, phone, role, passwordHash, stores: { create: storeIds.map((storeId) => ({ storeId })) } },
    });
  await db.userStore.create({ data: { userId: owner.id, storeId: central.id } });
  const manager = await mkUser('Kavya Iyer', 'manager@freshfold.test', '+919900000002', 'MANAGER', [downtown.id, central.id]);
  const counter = await mkUser('Rohan Das', 'counter@freshfold.test', '+919900000003', 'COUNTER_STAFF', [downtown.id]);
  const counterCentral = await mkUser('Anjali Rao', 'counter.central@freshfold.test', '+919900000006', 'COUNTER_STAFF', [central.id]);
  const processing = await mkUser('Meena Kumari', 'processing@freshfold.test', '+919900000004', 'PROCESSING_STAFF', [
    downtown.id,
    central.id,
  ]);
  const driver = await mkUser('Vikram Singh', 'driver@freshfold.test', '+919900000005', 'DRIVER', [downtown.id, central.id]);
  const counterFor = (storeId: string) => (storeId === downtown.id ? counter : counterCentral);

  // --- Racks --------------------------------------------------------------
  await createRackWithSlots(db, tenantId, downtown.id, 'Rack A', 'A', 12, 0);
  await createRackWithSlots(db, tenantId, downtown.id, 'Rack B', 'B', 10, 1, 2);
  await createRackWithSlots(db, tenantId, central.id, 'Rack A', 'A', 8, 0);
  await createRackWithSlots(db, tenantId, central.id, 'Rack C', 'C', 6, 1, 2);

  // --- Catalog lookups & extra price lists --------------------------------
  const categories = await db.serviceCategory.findMany({ where: { tenantId } });
  const items = await db.serviceItem.findMany({ where: { tenantId } });
  const settings = await db.tenantSettings.findUniqueOrThrow({ where: { tenantId } });
  const retailId = settings.defaultPriceListId!;
  const retailPrices = await db.priceListItem.findMany({ where: { priceListId: retailId } });

  const makeDiscountedList = async (name: string, description: string, factor: string) => {
    const list = await db.priceList.create({ data: { tenantId, name, description } });
    await db.priceListItem.createMany({
      data: retailPrices.map((p) => ({
        tenantId,
        priceListId: list.id,
        serviceCategoryId: p.serviceCategoryId,
        serviceItemId: p.serviceItemId,
        price: toDecimal(p.price.toString()).times(factor).toDecimalPlaces(0).toFixed(2),
      })),
    });
    return list;
  };
  const vip = await makeDiscountedList('VIP', 'Loyal customers — 10% below retail', '0.9');
  await makeDiscountedList('Corporate', 'Corporate accounts — 15% below retail', '0.85');

  const priceMap = new Map<string, Prisma.Decimal>();
  const allPrices = await db.priceListItem.findMany({ where: { tenantId } });
  for (const p of allPrices) priceMap.set(`${p.priceListId}:${p.serviceCategoryId}:${p.serviceItemId}`, p.price);
  const catByCode = new Map(categories.map((c) => [c.code, c]));
  const itemByName = new Map(items.map((i) => [i.name, i]));
  const modifiers = await db.serviceModifier.findMany({ where: { tenantId } });
  const express = modifiers.find((m) => m.name === 'Express Service')!;
  const stain = modifiers.find((m) => m.name === 'Stain Treatment')!;

  // --- Customers ----------------------------------------------------------
  const now = new Date();
  const todayKey = dateKeyInZone(now, TZ);
  const customers: Array<Prisma.CustomerGetPayload<{ include: { addresses: true } }>> = [];
  for (const [i, [firstName, lastName, phone, area]] of CUSTOMERS.entries()) {
    const createdAt = new Date(now.getTime() - between(40, 200) * 86400000);
    const customer = await db.customer.create({
      data: {
        tenantId,
        firstName,
        lastName,
        phone,
        email: chance(0.6) ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com` : null,
        notes: i === 0 ? 'Prefers light starch on shirts.' : i === 5 ? 'Corporate client — invoice monthly.' : null,
        priceListId: i === 2 || i === 8 ? vip.id : null,
        createdAt,
        addresses: {
          create: [
            {
              tenantId,
              label: 'Home',
              addressLine1: `${between(1, 240)}, ${area}`,
              city: 'Bengaluru',
              state: 'Karnataka',
              postalCode: `5600${between(10, 99)}`,
              country: 'India',
              isDefault: true,
            },
          ],
        },
      },
      include: { addresses: true },
    });
    customers.push(customer);
  }
  // A customer created today, so "Customers today" is not empty.
  const walkIn = await db.customer.create({
    data: {
      tenantId,
      firstName: 'Harsha',
      lastName: 'Bhat',
      phone: '9611122233',
      createdAt: now,
      addresses: { create: [{ tenantId, label: 'Home', addressLine1: '7, Ulsoor Road', city: 'Bengaluru', isDefault: true }] },
    },
    include: { addresses: true },
  });
  customers.push(walkIn);

  // --- Orders ---------------------------------------------------------------
  interface PlannedOrder {
    createdAt: Date;
    status: OrderStatus;
    storeId: string;
    customer: (typeof customers)[number];
    dueDate: Date;
    homeDelivery: boolean;
  }
  const planned: PlannedOrder[] = [];
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const key = addDaysToKey(todayKey, dayOffset);
    const [y, m, d] = key.split('-').map(Number);
    return zonedTimeToUtc(y!, m!, d!, hour, minute, TZ);
  };

  const add = (dayOffset: number, status: OrderStatus, opts: Partial<PlannedOrder> = {}) => {
    // Never in the future: today's orders are spread across the hours already passed.
    const createdAt = new Date(Math.min(at(dayOffset, between(9, 19), between(0, 59)).getTime(), now.getTime() - between(5, 240) * 60000));
    const turnaround = pick([2, 2, 3, 3, 4]);
    const dueDate = opts.dueDate ?? at(dayOffset + turnaround, 18);
    planned.push({
      createdAt,
      status,
      storeId: opts.storeId ?? (chance(0.65) ? downtown.id : central.id),
      customer: opts.customer ?? pick(customers.slice(0, CUSTOMERS.length)),
      dueDate,
      homeDelivery: opts.homeDelivery ?? chance(0.2),
    });
  };

  // History: delivered (and a few cancelled) over the past 6 weeks.
  for (let day = -42; day <= -4; day++) {
    const count = between(1, 4);
    for (let k = 0; k < count; k++) add(day, chance(0.05) ? 'CANCELLED' : 'DELIVERED');
  }
  // Recent pipeline.
  for (let k = 0; k < 4; k++) add(-3, 'DELIVERED');
  for (let k = 0; k < 3; k++) add(-3, 'READY');
  for (let k = 0; k < 3; k++) add(-2, 'READY');
  for (let k = 0; k < 3; k++) add(-2, 'QUALITY_CHECK');
  for (let k = 0; k < 2; k++) add(-2, 'DELIVERED');
  for (let k = 0; k < 4; k++) add(-1, 'PROCESSING');
  for (let k = 0; k < 2; k++) add(-1, 'READY');
  // Overdue: due yesterday, still processing.
  add(-4, 'PROCESSING', { dueDate: at(-1, 18) });
  add(-5, 'QUALITY_CHECK', { dueDate: at(-2, 18) });
  add(-3, 'RECEIVED', { dueDate: at(-1, 12) });
  // Due today.
  add(-2, 'QUALITY_CHECK', { dueDate: at(0, 18) });
  add(-2, 'READY', { dueDate: at(0, 17), customer: customers[0] });
  add(-1, 'PROCESSING', { dueDate: at(0, 19) });
  // Today.
  for (let k = 0; k < 5; k++) add(0, 'RECEIVED');
  add(0, 'RECEIVED', { customer: walkIn, storeId: downtown.id });
  add(0, 'PROCESSING');

  planned.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const orderSeqByYear = new Map<number, number>();
  let garmentSeq = 0;
  const slotUsage = new Map<string, number>();
  const slots = await db.rackSlot.findMany({
    where: { tenantId },
    include: { rack: true },
    orderBy: [{ rack: { displayOrder: 'asc' } }, { position: 'asc' }],
  });

  const statusPath: OrderStatus[] = ['RECEIVED', 'PROCESSING', 'QUALITY_CHECK', 'READY', 'DELIVERED'];
  let created = 0;

  for (const plan of planned) {
    const basket = pick(BASKETS);
    const priceListId = plan.customer.priceListId ?? retailId;
    const isExpress = chance(0.12);
    const resolved = basket.map((b) => {
      const cat = catByCode.get(b.category)!;
      const item = itemByName.get(b.item)!;
      const price = priceMap.get(`${priceListId}:${cat.id}:${item.id}`)!;
      const mods = [...(isExpress ? [{ m: express }] : []), ...(b.category === 'DC' && chance(0.15) ? [{ m: stain }] : [])];
      return { b, cat, item, price, mods };
    });
    const discount = chance(0.12)
      ? { type: 'PERCENT' as const, value: pick(['5', '10']) }
      : chance(0.05)
        ? { type: 'FIXED' as const, value: '50' }
        : null;
    const totals = calculateOrderTotals({
      lines: resolved.map((r) => ({
        unitPrice: r.price.toString(),
        quantity: r.b.qty,
        modifiers: r.mods.map(({ m }) => ({ type: m.type, value: m.value.toString() })),
      })),
      discount,
      taxRate: '18',
      taxInclusive: false,
    });

    const year = Number(dateKeyInZone(plan.createdAt, TZ).slice(0, 4));
    const seq = (orderSeqByYear.get(year) ?? 0) + 1;
    orderSeqByYear.set(year, seq);
    const orderId = randomUUID();
    const orderNumber = formatOrderNumber(settings.orderPrefix, year, seq);
    const staff = counterFor(plan.storeId);
    const stageCount = plan.status === 'CANCELLED' ? 1 : statusPath.indexOf(plan.status) + 1;
    const hoursBetween = Math.max(4, (plan.dueDate.getTime() - plan.createdAt.getTime()) / 3600000 / 4);
    const stageTimes = statusPath
      .slice(0, stageCount)
      .map(
        (_, i) =>
          new Date(
            Math.min(
              plan.createdAt.getTime() + i * hoursBetween * 3600000 + i * between(0, 90) * 60000,
              now.getTime() - (stageCount - i) * 60000,
            ),
          ),
      );
    const readyAt = stageCount >= 4 ? stageTimes[3]! : null;
    const deliveredAt = plan.status === 'DELIVERED' ? stageTimes[4]! : null;
    const cancelledAt = plan.status === 'CANCELLED' ? new Date(plan.createdAt.getTime() + 2 * 3600000) : null;

    // Payments: most delivered orders are fully paid; open orders vary.
    const payments: Array<{ amount: string; method: PaymentMethod; at: Date; by: string }> = [];
    const total = toDecimal(totals.grandTotal);
    const methodPick = () => pick<PaymentMethod>(['CASH', 'CASH', 'UPI', 'UPI', 'UPI', 'CARD', 'BANK_TRANSFER']);
    if (plan.status !== 'CANCELLED') {
      const r = rand();
      if (plan.status === 'DELIVERED') {
        if (r < 0.45) payments.push({ amount: totals.grandTotal, method: methodPick(), at: plan.createdAt, by: staff.id });
        else if (r < 0.9) {
          const advance = total.times(pick(['0.3', '0.5'])).toDecimalPlaces(0);
          payments.push({ amount: advance.toFixed(2), method: 'CASH', at: plan.createdAt, by: staff.id });
          payments.push({ amount: total.minus(advance).toFixed(2), method: methodPick(), at: deliveredAt!, by: staff.id });
        } else if (r < 0.96) {
          payments.push({ amount: totals.grandTotal, method: methodPick(), at: deliveredAt!, by: staff.id });
        } else {
          // Delivered on credit (corporate) — remains outstanding.
          payments.push({
            amount: total.times('0.5').toDecimalPlaces(0).toFixed(2),
            method: 'BANK_TRANSFER',
            at: plan.createdAt,
            by: manager.id,
          });
        }
      } else if (r < 0.35) {
        payments.push({ amount: totals.grandTotal, method: methodPick(), at: plan.createdAt, by: staff.id });
      } else if (r < 0.7) {
        payments.push({
          amount: total
            .times(pick(['0.3', '0.4', '0.5']))
            .toDecimalPlaces(0)
            .toFixed(2),
          method: methodPick(),
          at: plan.createdAt,
          by: staff.id,
        });
      }
    }
    const paid = sumMoney(payments.map((p) => p.amount));

    const lineIds = resolved.map(() => randomUUID());
    let pieces = 0;
    const garmentRows: Prisma.GarmentUnitCreateManyInput[] = [];
    const garmentStatus = plan.status;
    resolved.forEach((r, i) => {
      const n = garmentUnitsForLine(r.item.unitType, r.b.qty, r.item.piecesPerUnit);
      pieces += n;
      for (let g = 0; g < n; g++) {
        garmentSeq += 1;
        const issues: GarmentIssue[] = [];
        if (chance(0.08)) issues.push('STAIN');
        if (chance(0.03)) issues.push('MISSING_BUTTON');
        if (chance(0.03)) issues.push('TEAR');
        if (r.b.item === 'Saree' && chance(0.4)) issues.push('DELICATE');
        if (chance(0.04)) issues.push('COLOR_BLEED_RISK');
        garmentRows.push({
          tenantId,
          orderId,
          orderLineId: lineIds[i]!,
          tagCode: formatTagCode(settings.garmentPrefix, garmentSeq),
          status: garmentStatus,
          color: r.item.unitType === 'KG' ? null : pick(COLORS),
          brand: r.item.unitType === 'KG' ? null : pick(BRANDS),
          fabric: r.item.unitType === 'KG' ? null : pick(FABRICS),
          issues,
          damageNotes: issues.includes('TEAR')
            ? 'Small tear near the hem — customer informed'
            : issues.includes('STAIN')
              ? 'Oil stain on front'
              : null,
          specialInstructions: r.b.item === 'Shirt' && chance(0.2) ? 'Light starch' : null,
          createdAt: plan.createdAt,
        });
      }
    });

    await db.order.create({
      data: {
        id: orderId,
        tenantId,
        storeId: plan.storeId,
        customerId: plan.customer.id,
        orderNumber,
        status: plan.status,
        priceListId,
        subtotal: totals.subtotal,
        discountType: discount?.type ?? null,
        discountValue: discount?.value ?? null,
        discountAmount: totals.discountAmount,
        taxName: 'GST',
        taxRate: '18',
        taxInclusive: false,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal,
        paidAmount: paid,
        balanceDue: outstandingAmount(totals.grandTotal, paid),
        paymentStatus: derivePaymentStatus(totals.grandTotal, paid),
        totalPieces: pieces,
        dueDate: plan.dueDate,
        deliveryMode: plan.homeDelivery ? 'HOME_DELIVERY' : 'STORE_PICKUP',
        deliveryAddressId: plan.homeDelivery ? (plan.customer.addresses[0]?.id ?? null) : null,
        notes: isExpress ? 'Express — customer needs it urgently.' : null,
        createdById: staff.id,
        readyAt,
        deliveredAt,
        cancelledAt,
        cancelReason: cancelledAt ? 'Customer changed their mind' : null,
        createdAt: plan.createdAt,
        updatedAt: deliveredAt ?? readyAt ?? plan.createdAt,
      },
    });
    await db.orderLine.createMany({
      data: resolved.map((r, i) => ({
        id: lineIds[i]!,
        tenantId,
        orderId,
        serviceCategoryId: r.cat.id,
        serviceItemId: r.item.id,
        description: `${r.item.name} — ${r.cat.name}`,
        categoryName: r.cat.name,
        itemName: r.item.name,
        unitType: r.item.unitType,
        quantity: r.b.qty,
        unitPrice: r.price,
        modifiersAmount: totals.lines[i]!.modifiersAmount,
        lineTotal: totals.lines[i]!.lineTotal,
        position: i,
        createdAt: plan.createdAt,
      })),
    });
    const lineMods = resolved.flatMap((r, i) =>
      r.mods.map(({ m }) => {
        const qty = toDecimal(r.b.qty);
        const amount = priceModifier(
          { type: m.type, value: m.value.toString() },
          roundMoney(toDecimal(r.price.toString()).times(qty)),
          qty,
        );
        return {
          tenantId,
          orderLineId: lineIds[i]!,
          modifierId: m.id,
          name: m.name,
          type: m.type,
          value: m.value,
          amount: amount.toFixed(2),
        };
      }),
    );
    if (lineMods.length) await db.orderLineModifier.createMany({ data: lineMods });
    await db.garmentUnit.createMany({ data: garmentRows });

    // Status history (append-only timeline).
    const history: Prisma.OrderStatusHistoryCreateManyInput[] = [
      {
        tenantId,
        orderId,
        fromStatus: null,
        toStatus: 'RECEIVED',
        changedById: staff.id,
        changedAt: plan.createdAt,
        note: 'Order created',
      },
    ];
    for (let i = 1; i < stageCount; i++) {
      history.push({
        tenantId,
        orderId,
        fromStatus: statusPath[i - 1]!,
        toStatus: statusPath[i]!,
        changedById: i === 4 ? staff.id : processing.id,
        changedAt: stageTimes[i]!,
      });
    }
    if (cancelledAt) {
      history.push({
        tenantId,
        orderId,
        fromStatus: 'RECEIVED',
        toStatus: 'CANCELLED',
        changedById: manager.id,
        changedAt: cancelledAt,
        note: 'Customer changed their mind',
      });
    }
    await db.orderStatusHistory.createMany({ data: history });

    if (payments.length) {
      await db.payment.createMany({
        data: payments.map((p) => ({
          tenantId,
          orderId,
          storeId: plan.storeId,
          customerId: plan.customer.id,
          amount: p.amount,
          method: p.method,
          reference: p.method === 'UPI' ? `UPI${between(100000000, 999999999)}` : p.method === 'CARD' ? `XXXX${between(1000, 9999)}` : null,
          status: 'COMPLETED' as const,
          receivedById: p.by,
          receivedAt: p.at,
          createdAt: p.at,
        })),
      });
    }

    // Rack placement for ready orders; history for delivered ones.
    if (plan.status === 'READY' || (plan.status === 'DELIVERED' && chance(0.7))) {
      // Keep Downtown A03 free so the documented demo flow can use it.
      const storeSlots = slots.filter((s) => s.rack.storeId === plan.storeId && !(plan.storeId === downtown.id && s.code === 'A03'));
      const free = storeSlots.find((s) => (slotUsage.get(s.id) ?? 0) < s.capacity) ?? storeSlots[0]!;
      const active = plan.status === 'READY';
      if (active) slotUsage.set(free.id, (slotUsage.get(free.id) ?? 0) + 1);
      await db.rackAssignment.create({
        data: {
          tenantId,
          orderId,
          rackSlotId: active ? free.id : pick(storeSlots).id,
          assignedById: processing.id,
          assignedAt: readyAt!,
          removedAt: active ? null : deliveredAt,
          removedById: active ? null : staff.id,
          removalReason: active ? null : 'DELIVERED',
        },
      });
    }

    await db.auditLog.create({
      data: {
        tenantId,
        actorUserId: staff.id,
        action: 'ORDER_CREATED',
        entityType: 'Order',
        entityId: orderId,
        metadata: { orderNumber, grandTotal: totals.grandTotal, pieces },
        createdAt: plan.createdAt,
      },
    });

    // Delivery tasks for home-delivery orders that are ready.
    if (plan.homeDelivery && plan.status === 'READY') {
      await db.pickupDeliveryTask.create({
        data: {
          tenantId,
          storeId: plan.storeId,
          orderId,
          customerId: plan.customer.id,
          addressId: plan.customer.addresses[0]?.id ?? null,
          type: 'DELIVERY',
          status: 'ASSIGNED',
          address: `${plan.customer.addresses[0]?.addressLine1 ?? ''}, Bengaluru`,
          scheduledDate: new Date(`${todayKey}T00:00:00.000Z`),
          timeSlot: pick(['16:00-18:00', '18:00-20:00']),
          assignedDriverId: driver.id,
          createdById: manager.id,
        },
      });
    }
    created++;
  }

  for (const [year, value] of orderSeqByYear) {
    await db.tenantCounter.upsert({
      where: { tenantId_key: { tenantId, key: `order:${year}` } },
      create: { tenantId, key: `order:${year}`, value },
      update: { value },
    });
  }
  await db.tenantCounter.upsert({
    where: { tenantId_key: { tenantId, key: 'garment' } },
    create: { tenantId, key: 'garment', value: garmentSeq },
    update: { value: garmentSeq },
  });

  // --- Pickup requests ------------------------------------------------------
  const tomorrow = addDaysToKey(todayKey, 1);
  const pickups: Array<{
    c: (typeof customers)[number];
    date: string;
    slot: string;
    status: 'SCHEDULED' | 'ASSIGNED' | 'OUT_FOR_PICKUP' | 'PICKED_UP';
    driver: boolean;
    source: 'STAFF' | 'PUBLIC_BOOKING';
    service: string;
    notes?: string;
  }> = [
    {
      c: customers[3]!,
      date: todayKey,
      slot: '10:00-12:00',
      status: 'PICKED_UP',
      driver: true,
      source: 'PUBLIC_BOOKING',
      service: 'Dry Cleaning',
      notes: '2 suits and some shirts',
    },
    {
      c: customers[6]!,
      date: todayKey,
      slot: '12:00-14:00',
      status: 'OUT_FOR_PICKUP',
      driver: true,
      source: 'STAFF',
      service: 'Wash & Fold',
    },
    {
      c: customers[9]!,
      date: todayKey,
      slot: '16:00-18:00',
      status: 'ASSIGNED',
      driver: true,
      source: 'PUBLIC_BOOKING',
      service: 'Wash & Iron',
      notes: 'Ring the bell twice',
    },
    {
      c: customers[12]!,
      date: todayKey,
      slot: '18:00-20:00',
      status: 'SCHEDULED',
      driver: false,
      source: 'PUBLIC_BOOKING',
      service: 'Dry Cleaning',
      notes: 'Wedding lehenga — handle with care',
    },
    {
      c: customers[15]!,
      date: tomorrow,
      slot: '08:00-10:00',
      status: 'SCHEDULED',
      driver: false,
      source: 'PUBLIC_BOOKING',
      service: 'Steam Iron',
    },
    { c: customers[18]!, date: tomorrow, slot: '14:00-16:00', status: 'ASSIGNED', driver: true, source: 'STAFF', service: 'Wash & Fold' },
  ];
  for (const p of pickups) {
    await db.pickupDeliveryTask.create({
      data: {
        tenantId,
        storeId: downtown.id,
        customerId: p.c.id,
        addressId: p.c.addresses[0]?.id ?? null,
        type: 'PICKUP',
        status: p.status,
        source: p.source,
        address: `${p.c.addresses[0]?.addressLine1 ?? ''}, Bengaluru ${p.c.addresses[0]?.postalCode ?? ''}`.trim(),
        scheduledDate: new Date(`${p.date}T00:00:00.000Z`),
        timeSlot: p.slot,
        assignedDriverId: p.driver ? driver.id : null,
        requestedService: p.service,
        notes: p.notes ?? null,
        completedAt: p.status === 'PICKED_UP' ? new Date(now.getTime() - 90 * 60000) : null,
        createdById: p.source === 'STAFF' ? counter.id : null,
      },
    });
  }

  const totals = await db.order.aggregate({ where: { tenantId }, _count: { _all: true } });
  console.log(`✔ Tenant "${tenant.name}" (/book/${SLUG})`);
  console.log(`✔ ${customers.length} customers, ${totals._count._all} orders (${created} generated), ${garmentSeq} garments`);
  console.log('\nDemo logins (password for all: ' + PASSWORD + ')');
  for (const email of DEMO_EMAILS) console.log('  ' + email);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
