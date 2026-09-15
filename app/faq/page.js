import InfoPage from "@/components/InfoPage";

export const metadata = { title: "FAQ — Sella" };

export default function FAQPage() {
  return <InfoPage
    eyebrow="QUESTIONS"
    title="Frequently asked questions."
    intro="Everything you need to know before you start."
    sections={[
      {
        heading: "Who is Sella for?",
        body: "Any small business owner or independent seller — online resellers, shop owners, food and drink vendors, dropshippers — who currently sells through WhatsApp, Instagram, or in person and wants a proper store and order system behind it."
      },
      {
        heading: "How do buyers order?",
        body: "A buyer opens the link or Seller ID you share with them, creates a quick Sella account, and can then browse and buy from your store. They pay from their Sella wallet or by one-time bank transfer, then chat with you directly to arrange delivery once they've paid."
      },
      {
        heading: "Can anyone find my store, or only people I share it with?",
        body: "Only people you share your link or Seller ID with. Sella doesn't have open store discovery or search — your store isn't visible to random buyers browsing the platform."
      },
      {
        heading: "What does Sella cost?",
        body: "Every new store gets a 10-day free trial with up to 15 products, no card required. After that, choose a plan: Basic (3 months, ₦7,500), Plus (6 months, ₦14,000), or Premium (12 months, ₦25,000) — every plan has the same features. Sella also takes a 3% commission on each paid order. There are no fees charged to your buyers."
      },
      {
        heading: "Who handles delivery?",
        body: "You do, exactly as you already do today. Sella doesn't pack, ship, or deliver anything — once an order's paid, you contact the buyer directly through Sella's built-in chat to arrange pickup or delivery."
      },
      {
        heading: "How and when do I get paid?",
        body: "Payments land in your Sella wallet as soon as they're confirmed. You can withdraw to your bank account at any time; a small fee applies and is deducted from the amount withdrawn, and it's usually sent within 30 minutes to an hour."
      },
      {
        heading: "Do I need to verify my identity to sell on Sella?",
        body: "No — verifying your NIN or CAC-registered business is optional. It's there for sellers who want to build extra trust with buyers, not a requirement to open a store."
      }
    ]}
  />;
}
