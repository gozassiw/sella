# Sella — Nigerian commerce platform (Stage 2)

Sella gives each small business seller their own online store, while buyers can browse products, build a cart, check out, and track orders across stores.

The platform name is set in `NEXT_PUBLIC_BRAND_NAME`.

## Included in Stage 2

- Seller signup, store setup, product management, stock quantities, and public storefronts.
- Buyer cart with local persistence, quantity controls, stock limits, and single-store checkout.
- Buyer accounts with private order history, order detail pages, fulfilment choice, and delivery-code protection.
- Atomic server-side checkout that validates stock, creates the customer/order/items, and decrements stock in one database transaction.
- Seller orders dashboard with buyer contact details, items, fulfilment details, payment state, escrow state, and status updates.
- Buyer wallet foundation with a dedicated TransactPay virtual account when the provider is configured.
- TransactPay server-side virtual-account creation for orders and wallet funding.
- Idempotent TransactPay webhook endpoint at `/api/payments/transactpay` for order payments and buyer-wallet funding.
- Server-side money movement only: wallet debits, seller wallet credits, held escrow, and provider callbacks never use the browser's public database key.

## Supabase setup

Run the following SQL files in order against the connected Supabase project:

1. `supabase/schema.sql`
2. `supabase/sella-schema-additions.sql`
3. `supabase/stage-2-checkout.sql`

Row Level Security remains enabled. Buyers can read only their own orders and wallet activity; sellers can manage only their own store data; payment webhook events are server-only.

## Environment variables

Copy `.env.example` to `.env.local` for local development. In Vercel, add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_BRAND_NAME`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never expose it to the browser
- `TRANSACTPAY_BASE_URL` — use `https://payment-api-service.transactpay.ai` for the current sandbox/API base
- `TRANSACTPAY_PUBLIC_KEY`
- `TRANSACTPAY_SECRET_KEY` — server-only; reserved for protected provider operations
- `TRANSACTPAY_ENCRYPTION_KEY`

TransactPay currently requires RSA PKCS#1 v1.5 encrypted request payloads for virtual-account generation. Configure the webhook URL in TransactPay under **Settings & Security → API & Webhooks** as:

`https://sella-production.vercel.app/api/payments/transactpay`

The provider must be configured with a real merchant account and test/live keys before account numbers or payment confirmations can be exercised. Confirm with TransactPay that the intended escrow/hold arrangement is permitted under its licensing before processing real transactions.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

The production build is validated with:

```bash
npm run build
```

## Routes

- `/s/store-slug` — public storefront
- `/cart` — buyer cart
- `/checkout` — buyer checkout
- `/account` — buyer account
- `/account/orders` — buyer order history
- `/account/wallet` — buyer wallet and funding account
- `/dashboard/orders` — seller order management
- `/api/payments/transactpay` — TransactPay webhook receiver

## Next stages

1. ~~Seller signup, stores, products, storefront~~
2. ~~Cart, checkout, orders, stock updates, wallet and payment foundation~~
3. Offline sales, invoices, receipts, and customers list
4. Analytics, profit reporting, and expenses
5. Plans, billing, referrals, and platform admin panel
6. Verification, reports, withdrawals, and escrow release workflows
7. Custom domains and subdomains
8. AI store setup and product descriptions
