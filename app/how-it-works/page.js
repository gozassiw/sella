import InfoPage from "@/components/InfoPage";

export const metadata = { title: "How It Works — Sella" };

export default function HowItWorksPage() {
  return <InfoPage
    eyebrow="HOW SELLA WORKS"
    title="From setup to your next order."
    intro="Here's exactly what happens, from creating your store to getting paid."
    sections={[
      { heading: "Set up your store", body: "Sign up and set up your store in minutes — your business name, logo, description, and a WhatsApp contact for questions. Add your products with photos, selling price, and cost price so Sella can help you understand your margins. Once your store is reviewed and approved, you get your own store link and Seller ID to share with the customers you already have." },
      { heading: "Start free on Starter", body: "Every approved store starts on the free Starter plan with up to 40 active product listings and no expiry. When your store needs more capacity or a lower commission rate, you can upgrade to Basic, Plus, or Premium from your seller dashboard." },
      { heading: "Run the day-to-day", body: "Share your link, and people you share it with can find and buy from your store. When someone orders, you see it appear with the payment status, customer details, and total. Move each order through processing, out for delivery, and delivered — you handle delivery yourself. Once a buyer's paid, you can chat with them directly inside Sella to sort out delivery details. Every confirmed payment lands in your wallet, ready to withdraw to your bank." }
    ]}
  />;
}
