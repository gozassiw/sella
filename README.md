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
- `NEXT_PUBLIC_STORE_DOMAIN` — seller subdomain root, set to `sella.com.ng` so a store slug such as `adastore` becomes `https://adastore.sella.com.ng`
- `NEXT_PUBLIC_BRAND_NAME`
- `ADMIN_EMAILS` — comma-separated email addresses allowed to open `/admin`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never expose it to the browser
- `TRANSACTPAY_BASE_URL` — use `https://payment-api-service.transactpay.ai` for the current sandbox/API base
- `TRANSACTPAY_PUBLIC_KEY`
- `TRANSACTPAY_SECRET_KEY` — server-only; reserved for protected provider operations
- `TRANSACTPAY_ENCRYPTION_KEY`
- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — server-only Web Push configuration for browser/phone notifications

TransactPay currently requires RSA PKCS#1 v1.5 encrypted request payloads for virtual-account generation. Configure the webhook URL in TransactPay under **Settings & Security → API & Webhooks** as:

`https://www.sella.com.ng/api/payments/transactpay`

Use the direct `www` URL for TransactPay until the Vercel domain settings make the apex domain the primary domain. The apex currently redirects to `www`, and webhook providers should not be required to follow that redirect.

Buyers register from the **Create buyer account** link shown on each storefront, cart, and checkout page. Seller onboarding remains available through the main signup flow. A seller link is a subdomain such as `https://adastore.sella.com.ng`—not `adastore/sella.com.ng`. Add both `sella.com.ng` and `*.sella.com.ng` to the Vercel project, then configure the apex A record and wildcard CNAME at the domain registrar.

The provider must be configured with a real merchant account and test/live keys before account numbers, wallet funding, or plan payment confirmations can be exercised. Seller plan payment creates a one-time TransactPay account number for the selected amount; the seller plan is upgraded only after the verified webhook confirms payment. Confirm with TransactPay that the intended escrow/hold arrangement is permitted under its licensing before processing real transactions.

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
- `/account/notifications` — buyer in-app and phone notification settings
- `/dashboard/orders` — seller order management
- `/dashboard/wallet` — seller wallet and withdrawals
- `/dashboard/customers` — seller customer list
- `/dashboard/offline-sales` — offline sale records
- `/dashboard/invoices` — invoices and receipts
- `/dashboard/analytics` — sales, expense, and profit reports
- `/dashboard/billing` — subscription plans
- `/dashboard/notifications` — seller in-app and phone notification settings
- `/dashboard/verification` — seller verification submissions
- `/admin` — private admin controls for platform admins
- `/admin/notifications` — Admin in-app and phone notification settings

Product creation includes a **Suggest description** action. It uses `OPENAI_API_KEY` when configured and falls back to a safe template when it is not.

Buyer accounts and the buyer dashboard work before TransactPay is configured. The wallet displays an unconnected state until the three TransactPay credentials are added.

For buyer dedicated virtual accounts, the TransactPay endpoint requires the public API key and encryption key. The secret key remains configured server-side for other provider operations but is not required by the virtual-account generation request.

Seller stores start in **Pending approval**. Sellers must accept the Terms of Use and Privacy & Anti-Piracy Policy before submitting their details. While pending, the store is private and seller operations are blocked. Admin approval publishes the store and starts the **10-day free trial**; the trial clock therefore begins at approval rather than sign-up. Buyer registration also requires the same policy consent.

The Supabase project runs in `eu-west-1`, which is the intended Europe region for this deployment and is substantially closer to Nigeria than US regions. The performance pass also added explicit column selection, parallel independent queries, public-data caching, optimized Next.js images, and indexes for store approval, product feeds, buyer orders, seller orders, and follows.
- `/api/payments/transactpay` — TransactPay webhook receiver

## Next stages

1. ~~Seller signup, stores, products, storefront~~
2. ~~Cart, checkout, orders, stock updates, wallet and payment foundation~~
3. ~~Offline sales, customers list, analytics, profit reporting, and expenses~~
4. ~~Plans, billing, referrals, and platform admin panel foundation~~
5. ~~Verification, reports, withdrawals, and escrow release workflows~~
6. Custom domains and wildcard subdomains after a root domain is connected
7. AI store setup and product descriptions after an AI provider key is configured
