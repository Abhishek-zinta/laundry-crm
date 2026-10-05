# RinseOps

**Run your laundry business from one place.**

RinseOps is a multi-tenant SaaS for laundries, dry cleaners, wash & fold, ironing and shoe/bag cleaning businesses. The MVP is an admin/POS web app covering:

Customers → Orders → Garments → Processing → Racks → Payments → Pickup/Delivery → Reports

---

## Requirements

- Node.js **20.9+** (see `.nvmrc`) and npm 10+
- Docker with Docker Compose (for PostgreSQL 16 and Redis), **or** your own PostgreSQL 14+ server
- Ports: web `3000`, API `4000`, Postgres `5433`, Redis `6380`

No paid services are needed.

## Quick start

```bash
# 1. Infrastructure (Postgres on 5433, Redis on 6380; also creates the rinseops_test DB)
docker compose up -d

# 2. Environment
cp .env.example .env            # defaults work with docker compose

# 3. Dependencies
npm install

# 4. Database: apply migrations + load demo data
npm run db:deploy               # or: npm run db:migrate (dev, creates new migrations)
npm run db:seed

# 5. Run API + web together (watch mode)
npm run dev
```

Open:

- App: http://localhost:3000
- Public booking page: http://localhost:3000/book/freshfold
- API: http://localhost:4000/api/v1
- Swagger / OpenAPI docs: http://localhost:4000/api/v1/docs

## Demo credentials

All demo accounts use the password **`Password123!`**. The login page shows one-click demo buttons in development.

| Role             | Email                            | Lands on        |
| ---------------- | -------------------------------- | --------------- |
| Owner            | `owner@freshfold.test`           | Dashboard       |
| Manager          | `manager@freshfold.test`         | Dashboard       |
| Counter staff    | `counter@freshfold.test`         | New Order (POS) |
| Counter (Central)| `counter.central@freshfold.test` | New Order (POS) |
| Processing staff | `processing@freshfold.test`      | Garments        |
| Driver           | `driver@freshfold.test`          | My Tasks        |

The seed creates **FreshFold Laundry** with two stores (Downtown and Central) and 25 customers, including Priya Sharma (`9876543210`). It also adds about 130 orders across every workflow stage, payments, about 580 tagged garments, four racks with occupied slots, and pickup/delivery tasks. Re-running `npm run db:seed` only replaces the demo tenant.

## Environment configuration

| Variable            | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection for the app                              |
| `TEST_DATABASE_URL` | Separate database used by the API integration tests            |
| `REDIS_URL`         | Provisioned for future background jobs (not used by the MVP)   |
| `API_PORT`          | API port (default 4000)                                        |
| `WEB_ORIGIN`        | Comma-separated origins allowed for CORS + CSRF origin checks  |
| `SESSION_TTL_DAYS`  | Session lifetime                                               |
| `COOKIE_SECURE`     | `true` behind HTTPS so the session cookie gets `Secure`        |
| `API_INTERNAL_URL`  | Where the Next.js server proxies `/api/v1/*`                   |
| `NODE_ENV`          | `production` for deployments (enables the production checks)   |
| `TRUST_PROXY`       | Proxies allowed to set `X-Forwarded-For` (`loopback`, hop count, IPs/CIDRs) |
| `MOBILE_JWT_SECRET` | Signs mobile access tokens; required, random, 32+ chars in production |
| `MOBILE_ACCESS_TTL_MINUTES` / `MOBILE_REFRESH_TTL_DAYS` | Mobile token lifetimes (15 min / 30 days) |

`.env` is git-ignored; never commit real secrets.

## Commands

| Command                | What it does                                                |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Shared package (watch), API (watch) and web dev server       |
| `npm run build`        | Production build of shared, API and web                      |
| `npm run typecheck`    | TypeScript checks for every workspace                        |
| `npm run lint`         | ESLint for every workspace                                   |
| `npm test`             | Shared unit tests (Vitest) + API integration tests (Jest)    |
| `npm run format`       | Prettier                                                     |
| `npm run db:migrate`   | `prisma migrate dev` (create/apply migrations in development) |
| `npm run db:deploy`    | `prisma migrate deploy` (apply committed migrations)         |
| `npm run db:seed`      | Load demo data                                               |
| `npm run db:reset`     | Drop, re-migrate and re-seed the dev database                |
| `npm run db:studio`    | Prisma Studio                                                |

Production: `npm run build`, apply migrations with `npm run db:deploy` (needs the dev
dependency `prisma`, so run it from the build/release environment), then start the API with
`npm run start:prod -w @rinseops/api` (plain `node dist/main.js`; variables come from the
environment, not `.env`) and the web app with `npm run start -w @rinseops/web`. Never run
`db:seed` against production: it creates demo accounts with a published password.

Tests need `TEST_DATABASE_URL` pointing at an empty database; the suite applies migrations and truncates it.

---

## Project structure

```
.
├── apps/
│   ├── api/                 NestJS modular monolith (REST, Swagger)
│   │   ├── prisma/          schema.prisma, migrations/, seed.ts
│   │   ├── src/common/      auth guards, tenant-scoped Prisma, errors, audit, CSRF
│   │   ├── src/modules/     auth, tenants (settings + stores), users (staff), customers,
│   │   │                    catalog (pricing), orders, workflow, garments, payments,
│   │   │                    racks, pickup-delivery, public (booking), search,
│   │   │                    dashboard, reports, audit
│   │   └── test/            integration tests (tenant isolation, business flows)
│   └── web/                 Next.js 16 (App Router) + Tailwind 4
│       └── src/
│           ├── app/         routes: (auth), (app) shell, print/, book/[slug]
│           ├── components/  ui/ primitives, shared/ (DataTable, StatusBadge, …), app/ shell
│           ├── features/    one folder per domain: api hooks + screens/dialogs
│           └── lib/         API client, session, formatting, URL state, hotkeys
├── packages/shared/         enums, permissions, workflow rules, money/pricing engine,
│                            Zod schemas (API validation + web forms), API types
├── docker-compose.yml       Postgres 16 + Redis 7
└── infra/postgres/init/     creates the test database
```

## Architecture

- **Modular monolith.** Each NestJS module owns its controller, service and DTOs, and modules talk through services. Cross-cutting transactional helpers live next to their owning module (`payments/ledger.ts`, `racks/rack-ops.ts`).
- **Shared package.** Validation schemas, enums, the permission matrix, workflow transitions and the pricing engine are shared by the API and the web app. The POS preview and the server use the *same* `calculateOrderTotals`, and the server's result is always authoritative.
- **Multi-tenancy.** Every business table has `tenantId`. Services use `prisma.forTenant(tenantId)`, a Prisma client extension that injects `tenantId` into every read, update and delete `where`, and into every create. Raw SQL (reports, counters) filters by tenant explicitly. Users can also be restricted to specific stores.
- **Auth.** Email/password with Argon2id. Server-side sessions: an opaque random token sits in an HttpOnly, SameSite=Lax cookie, and only its SHA-256 hash is stored. Deactivating a user or resetting a password revokes their sessions.
  - CSRF defence: SameSite cookies plus an Origin/Sec-Fetch-Site check on state-changing requests.
  - Login, registration and public booking are rate-limited.
  - The browser only talks to the Next.js origin, which proxies `/api/v1/*` to the API, so the cookie stays first-party.
- **RBAC.** Granular permissions (`orders.deliver`, `payments.refund`, …) are mapped to the roles OWNER, MANAGER, COUNTER_STAFF, PROCESSING_STAFF and DRIVER. Every endpoint is guarded on the server; the UI only hides what the user can't do.
- **Money.** `DECIMAL(12,2)` in PostgreSQL and `decimal.js` in code, with half-up rounding. Values travel as strings (`"1191.80"`); no float arithmetic.
- **Integrity.**
  - Order creation (number, lines, garments, history, payments, audit) runs in one transaction.
  - Order rows are locked (`SELECT … FOR UPDATE`) for payments, status changes and rack moves, and rack slots are locked when assigned.
  - Per-tenant counters are atomic upserts.
  - Idempotency keys on order and payment creation make double-submits harmless.
  - Orders and payments are never hard-deleted: they are cancelled or refunded instead.
- **Time.** All timestamps are UTC (`timestamptz`). "Today", "due today", "overdue" and report ranges are computed in the business timezone.

## Database overview

| Area      | Models |
| --------- | ------ |
| Tenancy   | `Tenant`, `TenantSettings` (currency, timezone, tax, prefixes, workflow & booking options), `TenantCounter`, `Store` |
| Users     | `User` (role), `UserStore` (store assignment), `Session` |
| Customers | `Customer` (unique phone per tenant, trigram indexes for fast partial phone/name search), `CustomerAddress` |
| Catalog   | `ServiceCategory` (Dry Cleaning…), `ServiceItem` (Shirt…; unit PIECE/KG/PAIR; pieces per unit), `PriceList` (Retail/VIP/Corporate/store-specific), `PriceListItem`, `ServiceModifier` (Express, Stain Treatment…) |
| Orders    | `Order` (UUID id + `RO-YYYY-NNNNNN` number, cached totals), `OrderLine` (price snapshot), `OrderLineModifier`, `OrderStatusHistory` (append-only) |
| Garments  | `GarmentUnit` (`GAR-NNNNNN` tag, status, colour/brand/fabric, issues, damage notes), `GarmentStatusHistory`, `GarmentPhoto` (reserved) |
| Payments  | `Payment` ledger (method, status COMPLETED/REFUNDED/…, receivedBy). An order's `paidAmount`, `balanceDue` and `paymentStatus` are caches recomputed from the ledger in the same transaction. |
| Racks     | `Rack`, `RackSlot` (capacity), `RackAssignment` (history; current = `removedAt IS NULL`) |
| Logistics | `PickupDeliveryTask` (PICKUP/DELIVERY, source STAFF/PUBLIC_BOOKING, driver, status) |
| Audit     | `AuditLog` (actor, action, entity, metadata JSON) |

## Main screens

| Route | Screen |
| ----- | ------ |
| `/login`, `/register` | Sign in; register a business (creates tenant, first store, owner, starter catalog and rack) |
| `/dashboard` | Revenue, orders, pending/ready, unpaid, customers today; status strip; due today; overdue; recent orders/payments; 7-day collections |
| `/orders/new` | **POS**: phone-first customer lookup/creation, service categories, item tiles, cart with add-ons and garment condition, discount, collection mode, due date, payment, `Ctrl/⌘+Enter` to save |
| `/orders` | Order table with quick filters, status/payment/date filters, search (order #, phone, name, tag), sorting and pagination, all kept in the URL |
| `/orders/[id]` | Order detail: next-step button, payments, rack, print, edit, cancel; tabs for items, garments, payments, timeline + rack history, pickup/delivery |
| `/orders/[id]/edit` | Edit items while the order is still Received |
| `/customers`, `/customers/[id]` | Customer list; profile with stats, ready orders and rack location, addresses, order and payment history |
| `/garments` | Scan station (keyboard-wedge or camera QR), scan-to-update status, garment list by stage |
| `/racks` | Rack board per store; assign, move, remove; "ready but not racked" queue; rack/slot management |
| `/tasks` | Pickups & deliveries: assign drivers, status, reschedule, convert pickup → order |
| `/driver` | Mobile task cards for drivers (call, maps link, Start / Picked up / Delivered / Failed) |
| `/payments` | Payment ledger with method totals, filters, refunds |
| `/catalog` | Services & pricing: price-list matrix editor, services, items, add-ons |
| `/reports` | Sales, orders, payments, outstanding, services and customers reports, with CSV export |
| `/staff` | Staff management (roles, stores, activate/deactivate, password reset) |
| `/settings` | Business profile, tax, numbering, workflow, booking slots, stores, activity log |
| `/print/receipt/[id]` | 80 mm thermal receipt or A4 invoice (browser print) |
| `/print/tags/[id]` | Garment tags with QR codes (50×30 mm tag printer or A4 sheet) |
| `/book/[slug]` | Public, branded pickup booking page |

Shortcuts: `Ctrl/⌘+K` or `/` opens global search, `N` starts a new order, `1–9` switch POS services, `Ctrl/⌘+Enter` saves the order, and `Esc` closes dialogs.

## Main API endpoints (`/api/v1`)

| Area | Endpoints |
| ---- | --------- |
| Auth | `POST auth/register`, `POST auth/login`, `POST auth/logout`, `GET auth/me`, `POST auth/change-password` |
| Settings & stores | `PATCH settings`, `GET/POST stores`, `PATCH stores/:id` |
| Staff | `GET/POST staff`, `GET staff/drivers`, `GET/PATCH staff/:id` |
| Customers | `GET/POST customers`, `GET customers/lookup?phone=`, `GET/PATCH customers/:id`, `GET customers/:id/payments`, `POST/PATCH/DELETE customers/:id/addresses[/:addressId]` |
| Catalog | `GET catalog`, `GET catalog/pos`, `POST catalog/preview`, `POST/PATCH catalog/categories`, `catalog/items`, `catalog/modifiers`, `catalog/price-lists`, `PUT catalog/price-lists/:id/prices` |
| Orders | `GET/POST orders`, `GET orders/by-number/:n`, `GET/PATCH orders/:id`, `POST orders/:id/status`, `POST orders/:id/cancel` |
| Racks | `GET/POST racks`, `PATCH racks/:id`, `POST racks/:id/slots`, `PATCH racks/slots/:slotId`, `POST/DELETE orders/:id/rack` |
| Garments | `GET garments`, `GET garments/tag/:tag`, `GET/PATCH garments/:id`, `POST garments/:id/status`, `POST garments/bulk-status` |
| Payments | `GET/POST payments`, `POST payments/:id/refund` |
| Pickup & delivery | `GET/POST tasks`, `GET tasks/mine`, `GET/PATCH tasks/:id`, `POST tasks/:id/assign`, `POST tasks/:id/status` |
| Public | `GET public/tenants/:slug`, `POST public/tenants/:slug/bookings` |
| Insights | `GET search?q=`, `GET dashboard`, `GET reports/:type?preset=&from=&to=&storeId=&format=csv`, `GET audit` |

Errors always have the shape `{ statusCode, error: { code, message, details? } }`. `message` is safe to show to users (for example "This order still has ₹691.80 outstanding…"), and `code` lets the UI react, e.g. `DUPLICATE_PHONE`, `INVALID_STATUS_TRANSITION`, `RACK_SLOT_FULL` or `ORDER_ALREADY_CANCELLED`.

## Workflow rules

```
RECEIVED → PROCESSING → QUALITY_CHECK → READY → DELIVERED
     ↘ CANCELLED (before READY; only when no payments are held)
QUALITY_CHECK / READY → PROCESSING   (rework)
PROCESSING → READY                   (only when "skip quality check" is enabled)
```

- Order status changes cascade to its garments.
- Scanning garments forward advances the order automatically once *all* its garments reach the next stage.
- Delivering requires a zero balance. Only Owners and Managers can deliver on credit.
- Delivering, cancelling or sending back for rework releases the rack slot.
- A delivery task marked Delivered completes a fully-paid Ready order.
