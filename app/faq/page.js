import InfoPage from "@/components/InfoPage";

export const metadata = { title: "FAQ — Sella" };

export default function FAQPage() {
  return <InfoPage eyebrow="Questions" title="Frequently asked questions." intro="Placeholder page — the final FAQ answers will be added when you send them." sections={[{ heading: "Who is Sella for?", body: "[Placeholder: add the approved answer.]" }, { heading: "How do buyers order?", body: "[Placeholder: add the approved answer.]" }, { heading: "What does Sella cost?", body: "[Placeholder: add the approved answer about the ten-day trial, plans, and commission.]" }]} />;
}
