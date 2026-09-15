import InfoPage from "@/components/InfoPage";

export const metadata = { title: "How It Works — Sella" };

export default function HowItWorksPage() {
  return <InfoPage
    eyebrow="HOW SELLA WORKS"
    title="From setup to your next order."
    intro="Here's exactly what happens, from creating your store to getting paid."
    sections={[
      {
        heading: "Set up your store",
        body: "Sign up and set up your store in minutes — your business name, logo, description, and a WhatsApp contact for questions. You can optionally verify your identity (NIN) or your registered business (CAC) to build extra trust with buyers, though it's not required to get started. Add your products with photos, selling price, and cost price — Sella works out your margin automatically. Once your store is reviewed and approved, you get your own store link and Seller ID to share with the customers you already have."
      },
      {
        heading: "Run the day-to-day",
        body: "Share your link, and only the people you share it with can find and buy from your store. When someone orders, you see it appear instantly with the payment status, customer details, and total. Move each order through processing, out for delivery, and delivered — you handle delivery yourself, the way you already do today. Once a buyer's paid, you can chat with them directly inside Sella to sort out delivery details. Every payment lands straight in your wallet, ready to withdraw to your bank whenever you want. After your 10-day free trial, pick a plan that fits and keep going exactly as before."
      }
    ]}
  />;
}
