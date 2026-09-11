# Sella — build brief

Paste this whole document to Manus as your first message, along with your
Supabase Project URL and anon key, and this instruction:

> "Build this using my existing Supabase project below — don't create a new
> one. Use Next.js, Supabase and Vercel."

---

## What Sella is

Sella is a Nigerian commerce platform, similar to Bumpa. Small business
owners sign up and each gets their **own online store** — not a shared
marketplace. Customers order and pay on that seller's store, the seller
handles their own delivery, and Sella takes a commission on paid orders
plus a subscription fee from sellers.

Sella is **not** involved in delivery at all — sellers arrange pickup or
delivery directly with their customers.

---

## Seller features

**Sign up & store setup**
- Email/password sign-up, 14-day free trial.
- On signup: business name, store link (auto-suggested from the name,
  editable), category, WhatsApp number, store address.
- Optional identity verification (skippable, can be done later in
  Settings): full legal name, 11-digit NIN with a "Verify NIN" step that
  checks the name against the NIN (via a KYC provider such as Dojah,
  Youverify, or Korapay).
- Optional business registration (separate, also skippable): CAC number +
  certificate upload.

**Products**
- Name, description, price, optional old/compare-at price, stock quantity,
  up to 4 photos, active/hidden toggle.

**Orders**
- Statuses: New → Processing → Out for delivery → Delivered, or Cancelled.
- Each order shows the buyer's name, phone, email, and delivery address (or
  "pickup" if chosen).
- Seller contacts the buyer directly to arrange delivery or pickup — Sella
  charges no delivery fee and sets no delivery price.
- Cancelling is only allowed before the order ships; it restocks the items,
  refunds the buyer, and reverses any held/credited money.

**Wallet & money**
- Every paid order credits the seller's wallet, split into:
  - **Held (pending):** money not yet released.
  - **Available:** money the seller can withdraw.
- Money moves from held to available only when the delivery code is
  confirmed (see "Delivery code" below) — unless the seller is "Trusted"
  (see below), in which case it's credited straight to available.
- Sella takes a commission (default 5%, changeable by an admin) on the
  order total, deducted before crediting the seller.
- Sellers withdraw available funds to a bank account they set up in
  Settings (bank name, account number, and the account name looked up
  automatically). Withdrawals appear as a request in the admin panel to be
  marked "sent."

**Trust level**
- After a seller has a set number of orders (default 3, admin-configurable)
  go all the way to Delivered with the delivery code confirmed, they become
  **Trusted**: their future payments skip the hold and land straight in
  their available balance.
- An admin can also mark or unmark a seller as Trusted manually at any
  time.
- A reported order (see "Reports" below) stays held regardless of trust
  status, until the report is resolved.

**Plans**
- Three subscription options: 3 months ₦5,000, 6 months ₦9,000, 12 months
  ₦15,000.
- Paid from the seller's wallet balance, or by one-time bank transfer.

**Settings**
- Brand colour, logo, store description, delivery information text, pickup
  address, bank account for withdrawals, identity/business verification
  fields, and an open/closed toggle for the whole store.

---

## Buyer features

Buyers have **one Sella account and wallet that works across every store**
on the platform, not just one seller.

- **Wallet:** each buyer gets a dedicated virtual account number (via the
  payment provider) — any transfer to it funds their Sella wallet balance.
- **Browsing:** product grid, product detail page, cart, checkout.
- **Checkout:** name, phone, email, and a choice of "I'll pick it up" or
  "Deliver to me" (which asks for an address). No delivery fee is shown or
  charged by Sella — a note tells the buyer the seller will contact them
  afterward to arrange delivery and any cost.
- **Payment:** from their Sella wallet balance, or a one-time bank transfer
  to a generated account number for that order.
- **Buyer protection (escrow):** when an order is paid, a 4-digit delivery
  code is generated and shown **only inside that order in the buyer's own
  app** — never sent by SMS or push notification, so it can't be seen by
  anyone else. When the buyer actually receives the order, they give this
  code to the seller, who enters it to confirm delivery and release the
  held money.
- **Reports:** a buyer can report a specific order (reasons: not received,
  wrong item, damaged, other) or report a store generally (reasons: not
  responding, suspicious/scam behaviour, fake products, other). Reporting
  an order freezes its held money until an admin resolves it.
- **Navigation:** a bottom tab bar with Home, Orders, Cart, Wallet, and
  Account — mirroring the seller app's Home / Orders / Products / Wallet /
  Settings.

---

## Admin (company) features — never visible to sellers or buyers

- Total commission earned, total subscription revenue, list of all stores
  with their plan, order count, and trust status.
- A control to set the global commission percentage.
- A control to manually mark/unmark any store as Trusted.
- Seller verification review: see submitted NIN match status and CAC
  number/certificate, with an "Approve" action for the business.
- Withdrawal requests queue, with a "Mark as sent" action.
- Reports queue (both order reports and store reports), with a "Resolve"
  action.

---

## Store links (subdomains)

- Every store automatically gets its own address the moment the seller
  finishes signup — no manual setup needed. Format:
  `store-name.selladomain.com` (seller's name comes before the company
  domain).
- This needs a wildcard domain (`*.selladomain.com`) added in Vercel, the
  domain's nameservers pointed to Vercel, and a small piece of code
  (middleware) that reads the subdomain from the address and shows that
  seller's store.
- The main company site and seller/admin dashboards live at the plain
  domain (`selladomain.com`).

*(Replace `selladomain.com` with the real domain once it's bought — likely
sella.com.ng, since sella.com wasn't available.)*

---

## Payments

- Use **TransactPay** for: generating a one-time bank account per order
  payment, generating a permanent dedicated account per buyer wallet, and
  confirming payments via webhook.
- Actual money custody/escrow (holding buyer funds until delivery is
  confirmed) needs to be checked with TransactPay to confirm it fits under
  their licensing — flag this to them directly before relying on it for
  real transactions.

---

## Database

If a Supabase schema already exists for this project (`stores`,
`products`, `customers`, `orders`, `order_items`, `expenses`), extend it
rather than starting over. It will need new tables/fields for:

- `wallets` (one per seller and one per buyer): available balance, held
  balance.
- `wallet_transactions`: type (hold / release / withdrawal / refund /
  credit / plan payment), amount, related order, date.
- `subscriptions`: plan, start date, expiry date, amount paid.
- Extra fields on `stores`: legal_name, nin, nin_status, cac_number,
  cac_file_url, verification_approved, trusted (boolean), completed_orders
  (count).
- Extra fields on `orders`: delivery_code, escrow_status (held / released /
  refunded), reported_reason.
- `reports`: type (order/store), related store, related order (if any),
  reason, details, status (open/resolved), date.

Keep Row Level Security in place throughout: sellers can only see their own
store's data, buyers can only see their own orders and wallet, and none of
this is visible to the public except published store/product data.
