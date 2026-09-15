import InfoPage from "@/components/InfoPage";

export const metadata = { title: "About Us — Sella" };

export default function AboutPage() {
  return <InfoPage eyebrow="About Sella" title="A clearer way to run your store." intro="Placeholder page — the final About Us copy will be added when you send it." sections={[{ heading: "Who we are", body: "[Placeholder: add the approved story about Sella, Jojokev Digital, and the people building the platform.]" }, { heading: "What we believe", body: "[Placeholder: add the approved principles and the reason Sella exists for independent sellers.]" }]} />;
}
