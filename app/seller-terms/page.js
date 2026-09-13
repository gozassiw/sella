import LegalDocument from "@/components/LegalDocument";

export const metadata = { title: "Seller Terms of Use — Sella" };

export default function SellerTermsPage() {
  return <LegalDocument audience="Seller" title="Seller Terms of Use" intro="These terms apply when you create and operate a Sella store, list products, receive orders, manage seller funds, and use Sella business tools." sections={[
    { heading: "1. Seller account and verification", body: "Provide complete, accurate, and current business, identity, address, contact, and payout information. Sella Team may review your NIN and submitted details before approving a store. A store remains private and cannot accept orders until approval." },
    { heading: "2. Ten-day free trial", body: "After Sella approval, your store receives a 10-day free trial. During the trial, the catalog is limited to up to 15 products. The trial is provided so you can set up and test your store; it does not guarantee sales or continued access after the trial ends." },
    { heading: "3. Plans required after the trial", body: "After the 10-day free trial, you need an active paid plan to keep your store open, visible to buyers, and able to take new orders. Plans help fund store hosting, payment protection, support, and continued operation of Sella. Current plans are Basic — 3 months for ₦7,500; Plus — 6 months for ₦14,000; and Premium — 12 months for ₦25,000. Plan prices, durations, and platform rules may be updated with notice." },
    { heading: "4. Store and product responsibility", body: "You are responsible for the legality, authenticity, quality, description, pricing, stock, cost and selling-price information, customer communication, delivery, pickup, refunds where applicable, and fulfilment of every product you list. You may only upload materials you own or are authorised to use." },
    { heading: "5. Orders, payments, and withdrawals", body: "Update order progress accurately and fulfil paid orders as agreed. Platform commission, provider charges, deposit or transfer charges, and withdrawal fees are applied according to the relevant Sella payment flow and settings. Available balances are not a promise of immediate withdrawal; requests may be reviewed and processed under Sella controls." },
    { heading: "6. Reports, enforcement, and suspension", body: "Sella may review reports, reject or pause verification, remove listings, restrict store access, pause new orders, hold an account, or retain records while investigating fraud, piracy, unsafe conduct, false information, payment abuse, or a breach of these terms." },
    { heading: "7. Changes and contact", body: "Sella may update seller features, plans, fees, or these terms when the service or applicable requirements change. Questions should be sent through the support channel provided in your account." },
  ]} relatedHref="/seller-privacy" relatedLabel="Read Seller Privacy & Anti-Piracy Policy" />;
}
