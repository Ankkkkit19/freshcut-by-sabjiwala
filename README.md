# Sabjiwala / FreshCut — fresh grocery ecommerce platform

Production-oriented Next.js (App Router) + PostgreSQL platform for fresh vegetables, fruits, ready-to-cook
cut packs, salads and dairy. The customer storefront (FreshCut) and the admin console (Sabjiwala ops) share one
PostgreSQL database and one server-side pricing/cart/inventory engine — the same engine also powers WhatsApp
ordering.

## Stack

| Layer      | Technology                                                                |
| ---------- | ------------------------------------------------------------------------- |
| Frontend   | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Lucide icons |
| State      | Zustand for UI cache only (server is source of truth)                     |
| Backend    | Next.js Route Handlers, service layer in `src/server/*`, Zod validation   |
| Database   | PostgreSQL with **Drizzle ORM** (`src/db/schema.ts`)                      |
| Auth       | bcrypt password hashing + HttpOnly cookie sessions stored in Postgres     |

> The task brief mentioned Prisma; this sandbox is provisioned with Drizzle ORM, which is the platform's
> production ORM here. All models, constraints and indexes requested in the brief exist in
> `src/db/schema.ts` (equivalent schema, same guarantees).

## Environment

```
DATABASE_URL=postgresql://...            # required
NEXT_PUBLIC_APP_URL=http://localhost:3000
WHATSAPP_APP_SECRET=...                  # required to verify webhook signatures (else dev bypass flag)
WHATSAPP_ACCESS_TOKEN=...                # Cloud API token for outbound messages
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...                # webhook hub.verify_token
WHATSAPP_DEV_BYPASS=false                # true = accept unsigned dev webhooks (never in production)
SEED_ADMIN_PASSWORD=Admin@12345
SEED_CUSTOMER_PASSWORD=Demo@12345
SEED_WHATSAPP_NUMBER=+919876500011
```

Secrets are read from `process.env` at runtime only — never stored in the database or shipped to the browser.

## Setup

```bash
npx drizzle-kit push     # create/update tables
npx tsx src/db/seed.ts   # idempotent demo data (safe to re-run)
npm run dev              # or: npm run build && npm run start
```

### Demo accounts (development only)

| Role     | Email                   | Password    |
| -------- | ----------------------- | ----------- |
| Admin    | admin@freshcut.local    | Admin@12345 |
| Customer | demo@freshcut.local     | Demo@12345  |

The seeded admin WhatsApp identity is `+919876500011` (override with `SEED_WHATSAPP_NUMBER`), so WhatsApp admin
commands can be exercised immediately from Admin → WhatsApp → “Simulate an inbound message”.

## Feature map

- **Storefront**: homepage sections (hero, categories, popular, fresh today, ready-to-cook, recipes, why,
  trust), catalogue listing with real URL filters + pagination, product detail with variant and preparation
  selection, database-backed search (Hindi aliases like aloo/pyaz/tamatar), offers, recipes with ingredient
  baskets, cart, multi-step checkout, orders, profile + addresses, WhatsApp linking.
- **Admin**: dashboard (live stats with date filters), orders (search/filter/paginate/status transitions),
  products + variants CRUD, categories, coupons, offers, recipes, delivery zones, inventory ledger with raw →
  prepared yield, customers, analytics, WhatsApp console, settings, audit log.
- **Server-side pricing**: `/api/checkout` accepts only `addressId`, `couponCode`, `deliverySlot`,
  `paymentMethod`; prices, stock, coupon rules, delivery fee, GST and totals are recomputed in
  `src/server/pricing.ts` + `src/server/orders.ts` inside a transaction with row locks.
- **Inventory**: `stock_items` + `stock_transactions` ledger with RAW/PREPARED/RESERVED/SOLD/DAMAGED/WASTAGE/
  RETURN/ADJUSTMENT entries, negative stock rejection and yield conversion for cut products.
- **WhatsApp**: HMAC-SHA256 (`X-Hub-Signature-256`) webhook verification with timing-safe compare, per-message
  idempotency via a unique constraint, OTP-style one-time link codes, shared database cart, admin commands with
  expiring CONFIRM/CANCEL pending actions, notifications deduplicated per order+type.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
npx drizzle-kit push
npx tsx src/db/seed.ts
```

`GET /api/health` reports database connectivity for the platform healthcheck.
