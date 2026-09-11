# Start here — what to send Manus

This folder has everything Manus needs:

- **Working starter code** — sign up, store setup, products, and a public
  storefront already work.
- **sella-build-brief.md** — every feature Sella needs, written out in full.
- **supabase/schema.sql** and **supabase/sella-schema-additions.sql** — the
  database setup.

## Before you start

In Manus, go to **Settings → Connectors** and connect **GitHub** and
**Supabase**. This logs Manus into both directly — no copying and pasting
keys.

## What to send Manus

1. Start a new task in Manus.
2. Attach this whole folder (as the zip, or unzipped — either should work;
   if Manus can't open the zip, just tell it "unzip this file").
3. Paste the message below.

---

> I'm building a company called Sella — a Nigerian e-commerce platform
> where small business sellers each get their own online store. I've
> attached a working starter codebase (Next.js + Supabase), a full product
> brief (sella-build-brief.md) describing every feature I want, and the
> database setup (schema.sql and sella-schema-additions.sql).
>
> Please:
> 1. Read sella-build-brief.md fully before writing any code.
> 2. Use my connected Supabase project (via the Supabase connector) — don't
>    create a new one. Run schema.sql and then sella-schema-additions.sql
>    in it if they haven't been run yet.
> 3. Build on top of the attached starter code rather than starting from
>    scratch — it already has sign-up, store setup, products, and a public
>    storefront working.
> 4. Build it in stages, and show me each stage before moving to the next:
>    first orders and the buyer-side cart/checkout, then wallets and
>    escrow, then subscriptions and the admin panel, then seller/buyer
>    verification and reports.
> 5. Integrate TransactPay so every buyer automatically gets their own
>    dedicated virtual account number when they sign up. When money is
>    transferred into it, TransactPay should notify our app (a webhook),
>    which should automatically add that money to the buyer's wallet
>    balance. Look up TransactPay's current API documentation yourself, as
>    it may have changed. Build me an admin-only settings page with input
>    boxes to paste in whatever TransactPay API keys/secrets are needed, so
>    I can add or update them myself.
> 6. Anything that moves real money — crediting a wallet, releasing
>    escrow, approving a withdrawal — must happen in secure server-side
>    code using the Supabase service role key, never directly from the
>    browser.
> 7. Once a stage is working, push the code to my connected GitHub
>    repository (sella).

---

## After each stage

Test what Manus built before saying "continue" — click around as if you
were a seller, then as if you were a buyer. If something's wrong, describe
exactly what happened rather than approving it and hoping it gets fixed
later.

## One real-world step Manus can't do for you

TransactPay integration needs a real TransactPay merchant account and real
API keys — that's a business sign-up step, not something Manus can create.
If you don't have one yet, start that in parallel with Manus's build.
