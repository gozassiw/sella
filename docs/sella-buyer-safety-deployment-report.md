# Sella Buyer Safety and Trust Update

**Release:** `09e36d3`  
**Production:** `https://www.sella.com.ng`  
**Date:** 18 September 2026

## Overall result

The buyer-safety update is deployed through Sella’s existing GitHub-to-Vercel pipeline. It preserves the existing green brand, buyer and seller wallet architecture, dedicated-account payment flow, seller plan commissions and manual withdrawal model.

The public root remains intentionally gated to the launch waiting room. The deployed safety changes do not remove the private preview route or seller wildcard routing.

## Changes delivered

### Buyer registration

Buyer registration remains email-and-password based and does not require a store trust relationship. It now includes a compact **Shop with confidence** section explaining that sellers are independent businesses and that Sella provides the platform, payment-provider integration and a way to report problems. Existing buyer terms and privacy links remain in the form.

### Trust Store

Trusting a store now opens a confirmation modal containing the store name, logo when available, Store ID and the required safety notice. The acknowledgement checkbox must be selected before the Trust Store action can proceed. Cancel does not create a relationship, and an already trusted store does not repeatedly open the confirmation modal.

The server verifies a short-lived, actor-and-store-bound signed nonce. The trust mutation is executed through a service-role-only database function, so changing the browser request cannot bypass the acknowledgement. Duplicate relationships are prevented by a buyer/store uniqueness constraint. Removing trust marks the acknowledgement evidence as removed and does not delete orders, payments or complaint history.

Historical trust relationships were retained as legacy evidence without falsely claiming that the buyer acknowledged the new notice at that time.

### Checkout safety reminder

A small inline reminder appears only on a buyer’s first purchase from a store. It identifies the independent store and links to available store information and delivery information. It does not block checkout and it does not invent a refund policy where the seller has not supplied one. Returning buyers do not receive the repeated first-purchase warning.

### Reports & Safety

The existing reports system was extended rather than replaced. Buyers can report order non-receipt, suspected fraud, significantly inaccurate products, counterfeit or prohibited products, refund problems and other concerns from the relevant store or order context.

Each new case receives a unique `SLC-...` reference and has a status timeline using Submitted, Under Review, Awaiting Seller Response, Resolved and Closed. Buyers can view their own cases and buyer-visible updates. Sellers see only cases that require their context and only seller-visible timeline entries. Administrators can review case details, access short-lived signed evidence links, update status, keep private notes, record actions and request seller context.

Evidence is stored in a private Supabase bucket. The application validates file type and signature, limits uploads to three files, limits each file to 2 MB and the combined upload to 3 MB, and does not expose private storage paths to buyers or sellers. Case writes, status changes and seller responses are protected by role checks, ownership validation and audit history. Buyer, seller and admin notifications use the existing notification infrastructure on a best-effort basis.

### Seller withdrawal safety

The existing manual payout process remains in place. The ₦100 configured seller withdrawal fee remains unchanged, buyer fees remain zero, and no escrow or compulsory delivery hold was introduced. A payout cannot be recorded as completed solely because a receipt or reference was uploaded; the admin workflow requires a manual banking-channel confirmation with the settled amount, channel, reference, payment time and an explicit success check.

Failed and cancelled payout paths include duplicate-credit protections and audit records. A payment-provider restriction mechanism was **not activated** because the Sella–payment-provider agreement was not available for review. An ordinary complaint therefore does not automatically freeze seller funds.

## Database and production checks

The three additive safety migrations were applied successfully. Live checks confirmed the following:

| Check | Result |
| --- | --- |
| Buyer deposit fee | 0% |
| Buyer bank-transfer fee | 0% |
| Seller withdrawal fee | ₦100 |
| Direct authenticated trust insert | Denied |
| Direct authenticated withdrawal update | Denied |
| Evidence bucket | Private |
| Public verified-store enumeration | 0 stores |
| Legacy records falsely marked as acknowledged | 0 |
| Existing `admin_apply_action` store-approval logic | Present |

## Testing completed

The production build passed after merging the latest buyer, admin and seller workspace commits. The isolated PostgreSQL tests passed for trust acknowledgement, RLS, service-only trust mutation, legacy trust preservation, relationship removal and history preservation. The isolated reports test passed for buyer/seller isolation, evidence privacy, direct spoofing denial, legacy chat-report compatibility, role-checked admin review, private notes, seller requests and responses, buyer updates, audit history, unique case references and a private evidence bucket. The isolated withdrawal test passed for role checks, legacy bypass protection, no receipt-only completion, exact net amount, terminal states, duplicate references, idempotent retries, single refunds and audit history.

A real mobile browser harness at a 390-pixel viewport passed signup without trust, Trust Store modal gating, cancellation, successful acknowledgement, duplicate-modal prevention, report submission, first-purchase reminder behavior, returning-buyer behavior, admin private-note separation, manual payout confirmation and no horizontal overflow. The harness reported no browser runtime errors.

The live smoke checks returned the following results: `/` redirects to `/waiting`, `/waiting` returns 200, buyer signup returns 200, unauthenticated `/api/reports` returns 401, and `tomtom.sella.com.ng` returns 200.

## Remaining limitation

Automatic buyer launch emails or WhatsApp alerts are not part of this release because Sella has no configured email sender or official WhatsApp delivery provider. Waitlist collection and admin notification work, but sending a launch announcement to every waitlist contact requires connecting a compliant provider and adding an admin-controlled launch-send workflow. No claim of automatic launch delivery should be made until that provider is configured.

## References

[1]: https://vercel.com/docs/functions/limitations "Vercel Functions Limits"
