import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  calculateOrderTotals,
  garmentIconFor,
  CreateModifierInput,
  CreatePriceListInput,
  CreateServiceCategoryInput,
  CreateServiceItemInput,
  PricePreviewInput,
  UpdateModifierInput,
  UpdatePriceListInput,
  UpdateServiceCategoryInput,
  UpdateServiceItemInput,
  UpsertPriceListItemsInput,
} from '@rinseops/shared';
import { AuthContext } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { badRequest, conflict, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { TenantDb } from '../../common/prisma/tenant-extension';
import { money } from '../../common/util/serialize';
import { loadTenantSettings } from '../../common/util/tenant-settings';
import { PricingService } from './pricing.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
  ) {}

  /** Everything the Services & Pricing screen needs in one request. */
  async overview(ctx: AuthContext) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const [categories, items, priceLists, modifiers, settings] = await Promise.all([
      db.serviceCategory.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
      db.serviceItem.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
      db.priceList.findMany({
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        include: { store: { select: { id: true, name: true } }, _count: { select: { items: true, customers: true } } },
      }),
      db.serviceModifier.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
      loadTenantSettings(this.prisma, ctx.tenantId),
    ]);
    return {
      categories,
      items,
      priceLists: priceLists.map((p) => ({ ...p, isTenantDefault: p.id === settings.defaultPriceListId })),
      modifiers: modifiers.map((m) => ({ ...m, value: money(m.value) })),
      defaultPriceListId: settings.defaultPriceListId,
    };
  }

  /**
   * POS catalog: active categories with their priced items for the resolved
   * price list. One request renders the whole New Order screen.
   */
  async pos(ctx: AuthContext, opts: { priceListId?: string; customerId?: string; storeId?: string }) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const priceListId = await this.pricing.resolvePriceListId(db, opts);
    const [priceList, categories, prices, modifiers] = await Promise.all([
      db.priceList.findFirstOrThrow({ where: { id: priceListId }, select: { id: true, name: true } }),
      db.serviceCategory.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
      db.priceListItem.findMany({
        where: { priceListId, isActive: true, serviceItem: { isActive: true } },
        include: { serviceItem: true },
      }),
      db.serviceModifier.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
    ]);

    return {
      priceList,
      categories: categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          color: c.color,
          items: prices
            .filter((p) => p.serviceCategoryId === c.id)
            .sort((a, b) => a.serviceItem.displayOrder - b.serviceItem.displayOrder || a.serviceItem.name.localeCompare(b.serviceItem.name))
            .map((p) => ({
              serviceItemId: p.serviceItemId,
              name: p.serviceItem.name,
              unitType: p.serviceItem.unitType,
              piecesPerUnit: p.serviceItem.piecesPerUnit,
              icon: garmentIconFor(p.serviceItem.name, p.serviceItem.icon),
              price: money(p.price),
            })),
        }))
        .filter((c) => c.items.length > 0),
      modifiers: modifiers.map((m) => ({ id: m.id, name: m.name, type: m.type, value: money(m.value) })),
    };
  }

  /** Server-side total preview using the exact same rules as order creation. */
  async preview(ctx: AuthContext, input: PricePreviewInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const priceListId = await this.pricing.resolvePriceListId(db, { priceListId: input.priceListId, storeId: input.storeId });
    const resolved = await this.pricing.resolveLines(db, priceListId, input.lines);
    return calculateOrderTotals({
      lines: resolved.map((r, i) => ({ unitPrice: r.unitPrice, quantity: input.lines[i]!.quantity, modifiers: r.modifiers })),
      discount: input.discount,
      taxRate: settings.taxRate.toString(),
      taxInclusive: settings.taxInclusive,
    });
  }

  // --- Categories -----------------------------------------------------------

  async createCategory(ctx: AuthContext, input: CreateServiceCategoryInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    if (await db.serviceCategory.findFirst({ where: { code: input.code } })) {
      throw conflict('CATEGORY_CODE_TAKEN', `Service code ${input.code} is already used.`);
    }
    const row = await db.serviceCategory.create({ data: { ...input, tenantId: ctx.tenantId } });
    await this.logCatalog(db, ctx, 'ServiceCategory', row.id, { created: row.name });
    return row;
  }

  async updateCategory(ctx: AuthContext, id: string, input: UpdateServiceCategoryInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const existing = await db.serviceCategory.findFirst({ where: { id } });
    if (!existing) throw notFound('Service');
    if (input.code && input.code !== existing.code && (await db.serviceCategory.findFirst({ where: { code: input.code } }))) {
      throw conflict('CATEGORY_CODE_TAKEN', `Service code ${input.code} is already used.`);
    }
    const row = await db.serviceCategory.update({ where: { id }, data: input });
    await this.logCatalog(db, ctx, 'ServiceCategory', id, { fields: Object.keys(input) });
    return row;
  }

  // --- Items ----------------------------------------------------------------

  async createItem(ctx: AuthContext, input: CreateServiceItemInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    if (await db.serviceItem.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } })) {
      throw conflict('ITEM_NAME_TAKEN', `An item called ${input.name} already exists.`);
    }
    const row = await db.serviceItem.create({ data: { ...input, tenantId: ctx.tenantId } });
    await this.logCatalog(db, ctx, 'ServiceItem', row.id, { created: row.name });
    return row;
  }

  async updateItem(ctx: AuthContext, id: string, input: UpdateServiceItemInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const existing = await db.serviceItem.findFirst({ where: { id } });
    if (!existing) throw notFound('Item');
    if (
      input.name &&
      input.name.toLowerCase() !== existing.name.toLowerCase() &&
      (await db.serviceItem.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } }))
    ) {
      throw conflict('ITEM_NAME_TAKEN', `An item called ${input.name} already exists.`);
    }
    const row = await db.serviceItem.update({ where: { id }, data: input });
    await this.logCatalog(db, ctx, 'ServiceItem', id, { fields: Object.keys(input) });
    return row;
  }

  // --- Price lists ----------------------------------------------------------

  async priceListMatrix(ctx: AuthContext, priceListId: string) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const list = await db.priceList.findFirst({ where: { id: priceListId } });
    if (!list) throw notFound('Price list');
    const items = await db.priceListItem.findMany({ where: { priceListId } });
    return {
      priceList: list,
      prices: items.map((i) => ({
        serviceCategoryId: i.serviceCategoryId,
        serviceItemId: i.serviceItemId,
        price: money(i.price),
        isActive: i.isActive,
      })),
    };
  }

  async createPriceList(ctx: AuthContext, input: CreatePriceListInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    if (await db.priceList.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } })) {
      throw conflict('PRICE_LIST_NAME_TAKEN', `A price list called ${input.name} already exists.`);
    }
    if (input.storeId && !(await db.store.findFirst({ where: { id: input.storeId } }))) throw notFound('Store');
    const { copyFromPriceListId, ...data } = input;

    const list = await db.$transaction(async (tx) => {
      if (data.isDefault) await tx.priceList.updateMany({ where: { storeId: data.storeId ?? null }, data: { isDefault: false } });
      const created = await tx.priceList.create({ data: { ...data, tenantId: ctx.tenantId } });
      if (copyFromPriceListId) {
        const source = await tx.priceListItem.findMany({ where: { priceListId: copyFromPriceListId } });
        if (source.length) {
          await tx.priceListItem.createMany({
            data: source.map((s) => ({
              tenantId: ctx.tenantId,
              priceListId: created.id,
              serviceCategoryId: s.serviceCategoryId,
              serviceItemId: s.serviceItemId,
              price: s.price,
              isActive: s.isActive,
            })),
          });
        }
      }
      return created;
    });
    await this.logCatalog(db, ctx, 'PriceList', list.id, { created: list.name });
    return list;
  }

  async updatePriceList(ctx: AuthContext, id: string, input: UpdatePriceListInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const existing = await db.priceList.findFirst({ where: { id } });
    if (!existing) throw notFound('Price list');
    if (input.isActive === false) {
      const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
      if (settings.defaultPriceListId === id) {
        throw badRequest('DEFAULT_PRICE_LIST', 'Choose another default price list before deactivating this one.');
      }
    }
    const row = await db.$transaction(async (tx) => {
      if (input.isDefault) {
        const storeId = input.storeId !== undefined ? input.storeId : existing.storeId;
        await tx.priceList.updateMany({ where: { storeId: storeId ?? null, NOT: { id } }, data: { isDefault: false } });
      }
      return tx.priceList.update({ where: { id }, data: input });
    });
    await this.logCatalog(db, ctx, 'PriceList', id, { fields: Object.keys(input) });
    return row;
  }

  async upsertPrices(ctx: AuthContext, priceListId: string, input: UpsertPriceListItemsInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    if (!(await db.priceList.findFirst({ where: { id: priceListId } }))) throw notFound('Price list');

    const categoryIds = [...new Set(input.items.map((i) => i.serviceCategoryId))];
    const itemIds = [...new Set(input.items.map((i) => i.serviceItemId))];
    const [cats, items] = await Promise.all([
      db.serviceCategory.count({ where: { id: { in: categoryIds } } }),
      db.serviceItem.count({ where: { id: { in: itemIds } } }),
    ]);
    if (cats !== categoryIds.length || items !== itemIds.length) throw notFound('Service or item');

    await db.$transaction(async (tx) => {
      for (const item of input.items) {
        await tx.priceListItem.upsert({
          where: {
            priceListId_serviceCategoryId_serviceItemId: {
              priceListId,
              serviceCategoryId: item.serviceCategoryId,
              serviceItemId: item.serviceItemId,
            },
          },
          create: { ...item, tenantId: ctx.tenantId, priceListId },
          update: { price: item.price, isActive: item.isActive },
        });
      }
    });
    await this.logCatalog(db, ctx, 'PriceList', priceListId, { pricesUpdated: input.items.length });
    return this.priceListMatrix(ctx, priceListId);
  }

  // --- Modifiers ------------------------------------------------------------

  async createModifier(ctx: AuthContext, input: CreateModifierInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    if (await db.serviceModifier.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } })) {
      throw conflict('MODIFIER_NAME_TAKEN', `An add-on called ${input.name} already exists.`);
    }
    const row = await db.serviceModifier.create({ data: { ...input, tenantId: ctx.tenantId } });
    await this.logCatalog(db, ctx, 'ServiceModifier', row.id, { created: row.name });
    return { ...row, value: money(row.value) };
  }

  async updateModifier(ctx: AuthContext, id: string, input: UpdateModifierInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    if (!(await db.serviceModifier.findFirst({ where: { id } }))) throw notFound('Add-on');
    const row = await db.serviceModifier.update({ where: { id }, data: input });
    await this.logCatalog(db, ctx, 'ServiceModifier', id, { fields: Object.keys(input) });
    return { ...row, value: money(row.value) };
  }

  private logCatalog(db: TenantDb, ctx: AuthContext, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    return this.audit.log(db, ctx, { action: AuditAction.CATALOG_UPDATED, entityType, entityId, metadata });
  }
}
