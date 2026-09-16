import InfoPage from "@/components/InfoPage";

export const metadata = { title: "FAQ — Sella" };

export default function FAQPage() {
  return <InfoPage
    eyebrow="QUESTIONS"
    title="Frequently asked questions."
    intro="Everything you need to know before you start."
    sections={[
      { heading: "Who is Sella for?", body: "Any small business owner or independent seller — online resellers, shop owners, food and drink vendors, dropshippers — who currently sells through WhatsApp, Instagram, or in person and wants a proper store and order system behind it." },
      { heading: "How do buyers order?", body: "A buyer opens the link or Seller ID you share with them, creates a quick Sella account, and can then browse and buy from your store. They pay from their Sella wallet or by one-time bank transfer, then chat with you directly to arrange delivery once they've paid." },
      { heading: "Can anyone find my store, or only people I share it with?", body: "Unverified stores are invite-only: buyers find them through the link or Seller ID you share. Sellers with an approved paid verification checkmark may also be eligible for Sella's limited verified-store discovery feed." },
      { heading: "What does Sella cost?", body: "Every approved store starts on the free Starter plan with up to 40 active product listings and no expiry. Starter uses a 3.2% commission per paid order. Optional upgrades are Basic (3 months, ₦7,500, 2.8% commission, up to 150 active products), Plus (6 months, ₦14,000, 2.6% commission, up to 500 active products), and Premium (12 months, ₦25,000, 2.4% commission, unlimited active products)." },
      { heading: "Who handles delivery?", body: "You do, exactly as you already do today. Sella doesn't pack, ship, or deliver anything — once an order's paid, you contact the buyer directly through Sella's built-in chat to arrange pickup or delivery." },
      { heading: "How and when do I get paid?", body: "Payments land in your Sella wallet as soon as they're confirmed. You can withdraw to your bank account at any time; a payout charge may apply and is deducted from the amount withdrawn, and it is usually sent within 30 minutes to an hour." },
      { heading: "Do I need to verify my identity to sell on Sella?", body: "Yes. Seller verification is part of opening and operating a Sella store. Submit the requested identity and business information so the Sella Team can review your store before it goes live." }
    ]}
  />;
}
