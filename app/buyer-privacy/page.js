import LegalDocument from "@/components/LegalDocument";

export const metadata = { title: "Buyer Privacy & Anti-Piracy Policy — Sella" };

export default function BuyerPrivacyPage() {
  return <LegalDocument audience="Buyer" title="Buyer Privacy & Anti-Piracy Policy" intro="This policy explains the information Sella uses to help customers access trusted stores, place orders, receive fulfilment, and stay safe." sections={[
    { heading: "1. Buyer information we use", body: "Sella may use your name, call number, WhatsApp number, delivery address, trusted-store activity, cart and order details, wallet activity, reports, messages, notification preferences, and device subscription records to operate buyer features and support fulfilment." },
    { heading: "2. Payments and records", body: "Payment references, wallet debits, deposits, order records, and delivery events are retained for reconciliation, fraud prevention, support, legal obligations, and platform operations. Your private payment credentials are not shown to sellers." },
    { heading: "3. Sharing for fulfilment", body: "Information needed to complete an order, such as your name, contact details, fulfilment choice, and delivery address, may be made available to the relevant seller. Sella does not publish your buyer information as a public directory." },
    { heading: "4. Anti-piracy and reports", body: "Do not use Sella to request, upload, distribute, or promote pirated media, counterfeit goods, stolen images, unauthorised software, or other infringing material. Sella may remove reported content, restrict access, retain evidence, and cooperate with lawful requests." },
    { heading: "5. Notifications and choices", body: "In-app notifications are part of the service. Device notifications require permission and an active browser or web-app subscription. You can update your profile, trusted stores, notification settings, and device permissions; transaction and safety records may still need to be retained." },
    { heading: "6. Contact", body: "Questions about this policy should be sent through the support channel provided in your Sella account." },
  ]} relatedHref="/buyer-terms" relatedLabel="Read Buyer Terms of Use" />;
}
