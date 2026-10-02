import { Injectable } from '@nestjs/common';
import { ModifierType, UnitType } from '@rinseops/shared';
import { badRequest, notFound } from '../../common/errors/app-error';
import type { TenantDbOrTx } from '../../common/prisma/tenant-extension';

export interface ResolvedLine {
  serviceCategoryId: string;
  serviceItemId: string;
  categoryName: string;
  itemName: string;
  description: string;
  unitType: UnitType;
  piecesPerUnit: number;
  unitPrice: string;
  modifiers: Array<{ modifierId: string; name: string; type: ModifierType; value: string }>;
}

export interface LineRequest {
  serviceCategoryId: string;
  serviceItemId: string;
  modifierIds?: string[];
}

/** Resolves prices from configurable price lists — prices are never hardcoded. */
@Injectable()
export class PricingService {
  /**
   * Picks the price list for an order:
   * explicit → customer's list → store-specific default → tenant default.
   */
  async resolvePriceListId(
    db: TenantDbOrTx,
    opts: { priceListId?: string | null; customerId?: string | null; storeId?: string | null },
  ): Promise<string> {
    if (opts.priceListId) {
      const list = await db.priceList.findFirst({ where: { id: opts.priceListId, isActive: true } });
      if (!list) throw notFound('Price list');
      return list.id;
    }
    if (opts.customerId) {
      const customer = await db.customer.findFirst({
        where: { id: opts.customerId },
        select: { priceList: { select: { id: true, isActive: true } } },
      });
      if (customer?.priceList?.isActive) return customer.priceList.id;
    }
    if (opts.storeId) {
      const storeList = await db.priceList.findFirst({
        where: { storeId: opts.storeId, isActive: true, isDefault: true },
      });
      if (storeList) return storeList.id;
    }
    const settings = await db.tenantSettings.findFirst({ select: { defaultPriceListId: true } });
    if (settings?.defaultPriceListId) {
      const list = await db.priceList.findFirst({ where: { id: settings.defaultPriceListId, isActive: true } });
      if (list) return list.id;
    }
    const fallback = await db.priceList.findFirst({
      where: { isActive: true, storeId: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!fallback) throw badRequest('NO_PRICE_LIST', 'Set up a price list under Services & Pricing before creating orders.');
    return fallback.id;
  }

  /** Looks up current prices and modifier definitions for the requested lines. */
  async resolveLines(db: TenantDbOrTx, priceListId: string, lines: LineRequest[]): Promise<ResolvedLine[]> {
    const pairs = lines.map((l) => ({ serviceCategoryId: l.serviceCategoryId, serviceItemId: l.serviceItemId }));
    const modifierIds = [...new Set(lines.flatMap((l) => l.modifierIds ?? []))];

    const [prices, modifiers] = await Promise.all([
      db.priceListItem.findMany({
        where: { priceListId, isActive: true, OR: pairs },
        include: {
          serviceCategory: { select: { name: true, isActive: true } },
          serviceItem: { select: { name: true, unitType: true, piecesPerUnit: true, isActive: true } },
        },
      }),
      modifierIds.length ? db.serviceModifier.findMany({ where: { id: { in: modifierIds }, isActive: true } }) : Promise.resolve([]),
    ]);

    const priceMap = new Map(prices.map((p) => [`${p.serviceCategoryId}:${p.serviceItemId}`, p]));
    const modifierMap = new Map(modifiers.map((m) => [m.id, m]));

    return lines.map((line) => {
      const price = priceMap.get(`${line.serviceCategoryId}:${line.serviceItemId}`);
      if (!price || !price.serviceCategory.isActive || !price.serviceItem.isActive) {
        throw badRequest('ITEM_NOT_PRICED', 'One of the selected items has no active price in this price list.', {
          serviceCategoryId: line.serviceCategoryId,
          serviceItemId: line.serviceItemId,
        });
      }
      const mods = (line.modifierIds ?? []).map((id) => {
        const m = modifierMap.get(id);
        if (!m) throw badRequest('MODIFIER_NOT_FOUND', 'A selected add-on is no longer available.');
        return { modifierId: m.id, name: m.name, type: m.type as ModifierType, value: m.value.toString() };
      });
      return {
        serviceCategoryId: line.serviceCategoryId,
        serviceItemId: line.serviceItemId,
        categoryName: price.serviceCategory.name,
        itemName: price.serviceItem.name,
        description: `${price.serviceItem.name} — ${price.serviceCategory.name}`,
        unitType: price.serviceItem.unitType as UnitType,
        piecesPerUnit: price.serviceItem.piecesPerUnit,
        unitPrice: price.price.toString(),
        modifiers: mods,
      };
    });
  }
}
