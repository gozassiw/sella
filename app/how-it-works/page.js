import InfoPage from "@/components/InfoPage";

export const metadata = { title: "How It Works — Sella" };

export default function HowItWorksPage() {
  return <InfoPage eyebrow="How Sella works" title="From setup to your next order." intro="Placeholder page — the final How It Works copy will be added when you send it." sections={[{ heading: "Set up your store", body: "[Placeholder: explain seller onboarding, verification, store details, products, pricing, and the store link.]" }, { heading: "Run the day-to-day", body: "[Placeholder: explain orders, buyer chat, stock, margins, wallet balances, withdrawals, and plans.]" }]} />;
}
