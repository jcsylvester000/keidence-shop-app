# Keidence Inventory System — Web Application

Inventory management and sales kiosk terminal for **Keidence Bike shop** and
**AMP Hobbies**. A ground-up rebuild of the OpenSourcePOS concept in a modern
stack.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** with a custom Keidence brand palette
- **Prisma** schema targeting **Postgres / Neon.tech** (schema ready; not yet wired)
- **@zxing/browser** for camera-based QR / barcode scanning
- **lucide-react** icons

## What's built (Phase 1 — front end)

1. **Login** (`/login`) — branded sign-in with validation and error states.
   Demo accounts: `admin / admin`, `cashier / cashier`.
2. **Sales Register / Kiosk** (`/register`) — scan field that accepts hardware
   keyboard-wedge scanners (type code + Enter) **and** camera-based QR/barcode
   scanning, catalog quick-pick grid, running cart with quantity controls,
   checkout with payment method + change calculation, and a printable receipt.
   Completing a sale **decrements inventory**.
3. **Inventory** (`/inventory`) — product list with search and stock filters,
   add/edit products (name, category, barcode/SKU, cost & sell price, stock,
   reorder level), low-stock indicators, stock adjustments, and per-product
   movement history.
4. **Dashboard** (`/dashboard`) — KPIs (today's sales, stock value, low-stock
   count), quick actions, low-stock alerts, and recent sales.

### Data layer

The front end currently runs on an **in-memory mock store**
(`src/data/store.ts`) seeded with realistic bike-shop and hobby-store products.
Every function there has the same shape it will have as a real API call, so
wiring the database later means replacing bodies, not call sites. Sales and
inventory are already linked: a completed sale writes an append-only ledger
movement and decrements product stock.

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`,
`npm run prisma:generate`.

## Next steps (not yet done)

- Wire the front end to Neon Postgres via Prisma (API routes / server actions)
- Real authentication (bcrypt against the `users` table; e.g. NextAuth)
- Per-store / location dimension (Keidence vs AMP Hobbies) — the schema is
  structured to add this without a rewrite
- Push to GitHub, deploy to Netlify

## Database

`prisma/schema.prisma` defines the trimmed Postgres model: `users`,
`products`, `inventory_transactions` (append-only ledger), `sales`,
`sale_items`, `sale_payments`. Copy `.env.example` to `.env` and set
`DATABASE_URL` from your Neon dashboard when wiring the DB.
