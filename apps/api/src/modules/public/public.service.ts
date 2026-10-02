import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  addDaysToKey,
  AuditAction,
  DEFAULT_TIME_SLOTS,
  dateKeyInZone,
  normalizePhone,
  PublicBookingInput,
  TaskStatus,
} from '@rinseops/shared';
import { AuditService } from '../../common/audit/audit.service';
import { AppError, badRequest } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { dateFromKey } from '../../common/util/serialize';
import { formatAddress } from '../pickup-delivery/address-format';

const MAX_DAYS_AHEAD = 30;

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Branding and options for the public booking page. Only non-sensitive fields. */
  async tenantProfile(slug: string) {
    const tenant = await this.findTenant(slug);
    const db = this.prisma.forTenant(tenant.id);
    const [stores, categories] = await Promise.all([
      db.store.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true }, orderBy: { createdAt: 'asc' } }),
      db.serviceCategory.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { displayOrder: 'asc' } }),
    ]);
    const s = tenant.settings!;
    const today = dateKeyInZone(new Date(), s.timezone);
    return {
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      phone: tenant.phone,
      brandColor: s.brandColor,
      bookingEnabled: s.bookingEnabled,
      timeSlots: s.timeSlots.length ? s.timeSlots : [...DEFAULT_TIME_SLOTS],
      services: categories.map((c) => c.name),
      stores,
      minDate: today,
      maxDate: addDaysToKey(today, MAX_DAYS_AHEAD),
    };
  }

  /** Creates (or reuses) the customer and a pickup request. No login required. */
  async book(slug: string, input: PublicBookingInput, ipAddress?: string) {
    const tenant = await this.findTenant(slug);
    const settings = tenant.settings!;
    if (!settings.bookingEnabled) {
      throw new AppError('BOOKING_DISABLED', 'Online booking is currently unavailable. Please call us instead.', HttpStatus.FORBIDDEN);
    }
    if (input.website) {
      // Honeypot filled in: pretend success, store nothing.
      this.logger.warn(`Booking honeypot triggered for ${slug} from ${ipAddress ?? 'unknown'}`);
      return { reference: 'RECEIVED', pickupDate: input.pickupDate, timeSlot: input.timeSlot };
    }

    const today = dateKeyInZone(new Date(), settings.timezone);
    if (input.pickupDate < today || input.pickupDate > addDaysToKey(today, MAX_DAYS_AHEAD)) {
      throw badRequest('INVALID_PICKUP_DATE', `Choose a pickup date within the next ${MAX_DAYS_AHEAD} days.`);
    }
    const slots = settings.timeSlots.length ? settings.timeSlots : [...DEFAULT_TIME_SLOTS];
    if (!slots.includes(input.timeSlot)) throw badRequest('INVALID_TIME_SLOT', 'Please choose one of the available time slots.');

    const db = this.prisma.forTenant(tenant.id);
    const store = input.storeId
      ? await db.store.findFirst({ where: { id: input.storeId, isActive: true } })
      : await db.store.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!store) throw badRequest('NO_STORE', 'This business is not accepting bookings right now.');

    const phone = normalizePhone(input.phone);
    const [firstName, ...rest] = input.name.trim().split(/\s+/);
    const actor = { tenantId: tenant.id, userId: null, ipAddress };

    const task = await db.$transaction(async (tx) => {
      let customer = await tx.customer.findFirst({ where: { phone } });
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId: tenant.id,
            firstName: firstName ?? input.name,
            lastName: rest.join(' ') || null,
            phone,
            email: input.email ?? null,
            notes: 'Created from online booking',
          },
        });
        await this.audit.log(tx, actor, {
          action: AuditAction.CUSTOMER_CREATED,
          entityType: 'Customer',
          entityId: customer.id,
          metadata: { source: 'PUBLIC_BOOKING' },
        });
      }

      const addressInput = {
        addressLine1: input.address.addressLine1,
        addressLine2: input.address.addressLine2 ?? null,
        landmark: input.address.landmark ?? null,
        city: input.address.city ?? null,
        postalCode: input.address.postalCode ?? null,
      };
      let address = await tx.customerAddress.findFirst({
        where: { customerId: customer.id, addressLine1: { equals: addressInput.addressLine1, mode: 'insensitive' } },
      });
      if (!address) {
        const hasDefault = await tx.customerAddress.count({ where: { customerId: customer.id, isDefault: true } });
        address = await tx.customerAddress.create({
          data: { tenantId: tenant.id, customerId: customer.id, label: 'Home', ...addressInput, isDefault: hasDefault === 0 },
        });
      }

      const created = await tx.pickupDeliveryTask.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          customerId: customer.id,
          addressId: address.id,
          type: 'PICKUP',
          status: TaskStatus.SCHEDULED,
          source: 'PUBLIC_BOOKING',
          address: formatAddress(addressInput),
          scheduledDate: dateFromKey(input.pickupDate),
          timeSlot: input.timeSlot,
          requestedService: input.requestedService ?? null,
          notes: input.notes ?? null,
        },
      });
      await this.audit.log(tx, actor, {
        action: AuditAction.TASK_CREATED,
        entityType: 'PickupDeliveryTask',
        entityId: created.id,
        metadata: { source: 'PUBLIC_BOOKING', pickupDate: input.pickupDate, timeSlot: input.timeSlot },
      });
      return created;
    });

    return {
      reference: task.id.slice(0, 8).toUpperCase(),
      pickupDate: input.pickupDate,
      timeSlot: input.timeSlot,
      storeName: store.name,
    };
  }

  private async findTenant(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      include: { settings: true },
    });
    if (!tenant || tenant.status !== 'ACTIVE' || !tenant.settings) {
      throw new AppError('BUSINESS_NOT_FOUND', "We couldn't find this business.", HttpStatus.NOT_FOUND);
    }
    return tenant;
  }
}
