import LegalDocument from "@/components/LegalDocument";

export const metadata = { title: "Seller Privacy & Anti-Piracy Policy — Sella" };

export default function SellerPrivacyPage() {
  return <LegalDocument audience="Seller" title="Seller Privacy & Anti-Piracy Policy" intro="This policy explains the information Sella uses to verify sellers, operate stores, process orders and payouts, and protect buyers and the platform." sections={[
    { heading: "1. Seller information we use", body: "Sella may use your name, email, business and legal name, store link, address, phone and WhatsApp details, NIN and validation status, optional CAC details and uploads, payout details, products, cost and selling prices, orders, balances, withdrawals, reports, messages, notification preferences, and device subscription records." },
    { heading: "2. Verification and payment operations", body: "Identity, business, payout, payment, order, withdrawal, and audit records may be reviewed by authorised Sella Team personnel and retained for verification, reconciliation, fraud prevention, fulfilment support, legal obligations, and platform operations. Secret payment credentials are stored server-side and are not shown after saving." },
    { heading: "3. Buyer information and fulfilment", body: "Information needed to fulfil an order may be shown to you for the relevant buyer and order. Use buyer information only for legitimate Sella fulfilment, support, delivery, and order communication. Do not export, sell, misuse, or publicly disclose buyer information." },
    { heading: "4. Anti-piracy and intellectual property", body: "You may only list or upload goods, images, descriptions, logos, documents, software, media, and other materials that you own or are authorised to use. Counterfeit goods, copied listings, stolen images, unauthorised software, pirated media, and other infringing content are prohibited. Sella may remove content, reject verification, suspend a store, and preserve evidence when investigating." },
    { heading: "5. Notifications and choices", body: "In-app notifications are available to authenticated sellers. Device notifications require permission and an active browser or web-app subscription. You can update your profile and notification settings, but verification, payment, order, report, and audit records may need to be retained." },
    { heading: "6. Contact", body: "Questions about this policy should be sent through the support channel provided in your Sella account." },
  ]} relatedHref="/seller-terms" relatedLabel="Read Seller Terms of Use" />;
}
