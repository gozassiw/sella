import LegalDocument from "@/components/LegalDocument";

export const metadata = { title: "Buyer Terms of Use — Sella" };

export default function BuyerTermsPage() {
  return <LegalDocument audience="Buyer" title="Buyer Terms of Use" intro="These terms apply when you use Sella to open trusted stores, shop, pay, and receive orders as a customer." sections={[
    { heading: "1. Your buyer account", body: "Provide accurate profile, call, WhatsApp, delivery, and payment information. Keep your password and device secure, and do not let another person use your account." },
    { heading: "2. Store access and trust", body: "You open a store through the seller-provided store link or store ID. Trust is your choice, and you must trust a store before adding products to cart or checking out. Trusting a store does not remove your responsibility to review its products, prices, fulfilment information, and seller details." },
    { heading: "3. Orders and payment", body: "Review your items, fulfilment choice, contact details, and total before paying. Wallet payments and TransactPay-confirmed bank transfers are recorded in Sella when confirmation is received. Do not attempt to manipulate payment, wallet, order, or delivery records." },
    { heading: "4. Delivery and communication", body: "Give the seller information needed to fulfil your order and respond when delivery or pickup requires confirmation. Order updates may appear in Sella and, if enabled, as device notifications. Sella does not guarantee a seller's delivery time or product quality." },
    { heading: "5. Reports and account safety", body: "Report a product, store, order, message, or account when you believe there is fraud, piracy, unsafe conduct, or another serious issue. Sella may pause an account, store access, wallet action, or order while reviewing a report or protecting payment integrity." },
    { heading: "6. Changes and contact", body: "Sella may update buyer features or these terms when the service or applicable requirements change. Questions and support requests should be sent through the support channel provided in your account." },
  ]} relatedHref="/buyer-privacy" relatedLabel="Read Buyer Privacy & Anti-Piracy Policy" />;
}
