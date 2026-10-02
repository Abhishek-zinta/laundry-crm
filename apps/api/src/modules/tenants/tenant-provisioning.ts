import { Prisma } from '@prisma/client';
import { DEFAULT_TIME_SLOTS, formatTagCode, Role } from '@rinseops/shared';
import { STARTER_CATEGORIES, STARTER_ITEMS, STARTER_MODIFIERS, STARTER_PRICES } from '../catalog/starter-catalog';

type Tx = Prisma.TransactionClient;

export interface ProvisionTenantInput {
  businessName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  passwordHash: string;
  storeName: string;
  storeCode?: string;
  currency: string;
  timezone: string;
  locale?: string;
  taxRate?: string;
  starterCatalog?: boolean;
  starterRacks?: boolean;
}

/**
 * Creates a fully usable business: tenant, settings, first store, owner,
 * and optionally a starter catalog and rack. Runs inside the caller's transaction.
 */
export async function provisionTenant(tx: Tx, input: ProvisionTenantInput) {
  const tenant = await tx.tenant.create({
    data: { name: input.businessName, slug: input.slug, email: input.ownerEmail, phone: input.ownerPhone ?? null },
  });

  const store = await tx.store.create({
    data: {
      tenantId: tenant.id,
      name: input.storeName,
      code: input.storeCode ?? storeCodeFromName(input.storeName),
    },
  });

  const owner = await tx.user.create({
    data: {
      tenantId: tenant.id,
      name: input.ownerName,
      email: input.ownerEmail,
      phone: input.ownerPhone ?? null,
      passwordHash: input.passwordHash,
      role: Role.OWNER,
      stores: { create: [{ storeId: store.id }] },
    },
  });

  let defaultPriceListId: string | null = null;
  if (input.starterCatalog !== false) {
    defaultPriceListId = await createStarterCatalog(tx, tenant.id);
  }

  await tx.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      currency: input.currency,
      timezone: input.timezone,
      locale: input.locale ?? (input.currency === 'INR' ? 'en-IN' : 'en-US'),
      taxRate: input.taxRate ?? '0',
      timeSlots: [...DEFAULT_TIME_SLOTS],
      defaultPriceListId,
      receiptFooter: 'Thank you for choosing us! Please collect your garments within 30 days.',
    },
  });

  if (input.starterRacks !== false) {
    await createRackWithSlots(tx, tenant.id, store.id, 'Rack A', 'A', 12, 0);
  }

  return { tenant, store, owner };
}

export async function createStarterCatalog(tx: Tx, tenantId: string): Promise<string> {
  const categories = new Map<string, string>();
  for (const [i, c] of STARTER_CATEGORIES.entries()) {
    const row = await tx.serviceCategory.create({
      data: { tenantId, name: c.name, code: c.code, color: c.color, description: c.description, displayOrder: i },
    });
    categories.set(c.code, row.id);
  }

  const items = new Map<string, string>();
  for (const [i, item] of STARTER_ITEMS.entries()) {
    const row = await tx.serviceItem.create({
      data: {
        tenantId,
        name: item.name,
        unitType: item.unitType,
        icon: item.icon,
        piecesPerUnit: item.piecesPerUnit ?? 1,
        displayOrder: i,
      },
    });
    items.set(item.name, row.id);
  }

  const retail = await tx.priceList.create({
    data: { tenantId, name: 'Retail', description: 'Standard walk-in prices', isDefault: true },
  });

  const rows: Prisma.PriceListItemCreateManyInput[] = [];
  for (const [itemName, prices] of Object.entries(STARTER_PRICES)) {
    for (const [code, price] of Object.entries(prices)) {
      const serviceCategoryId = categories.get(code);
      const serviceItemId = items.get(itemName);
      if (!serviceCategoryId || !serviceItemId || !price) continue;
      rows.push({ tenantId, priceListId: retail.id, serviceCategoryId, serviceItemId, price });
    }
  }
  await tx.priceListItem.createMany({ data: rows });

  await tx.serviceModifier.createMany({
    data: STARTER_MODIFIERS.map((m, i) => ({ tenantId, name: m.name, type: m.type, value: m.value, displayOrder: i })),
  });

  return retail.id;
}

export async function createRackWithSlots(
  tx: Tx,
  tenantId: string,
  storeId: string,
  name: string,
  code: string,
  slotCount: number,
  displayOrder: number,
  slotCapacity = 1,
) {
  const rack = await tx.rack.create({ data: { tenantId, storeId, name, code, displayOrder } });
  if (slotCount > 0) {
    await tx.rackSlot.createMany({
      data: Array.from({ length: slotCount }, (_, i) => ({
        tenantId,
        rackId: rack.id,
        code: slotCode(code, i + 1),
        capacity: slotCapacity,
        position: i,
      })),
    });
  }
  return rack;
}

/** "A", 3 → "A03" */
export function slotCode(rackCode: string, n: number): string {
  return `${rackCode}${String(n).padStart(2, '0')}`;
}

export function storeCodeFromName(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (letters || 'MAIN').slice(0, 6);
}

// Re-exported for the seed to build tag codes consistently.
export { formatTagCode };
