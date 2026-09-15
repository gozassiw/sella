import InfoPage from "@/components/InfoPage";

export const metadata = { title: "About Us — Sella" };

export default function AboutPage() {
  return <InfoPage
    eyebrow="ABOUT SELLA"
    title="A clearer way to run your store."
    intro="Sella is built by Jojokev Digital, a Nigerian company, for the sellers already running real businesses through WhatsApp, Instagram, and word of mouth — just without the tools to match."
    sections={[
      {
        heading: "Who we are",
        body: "Jojokev Digital is a Nigerian commerce company. We build Sella, a platform that gives small business owners and independent sellers their own online store — without needing to know how to code, hire a developer, or pay for a website they don't fully understand. Most Nigerian sellers already have real customers and real sales; what they've been missing is a proper place to run the business behind those sales."
      },
      {
        heading: "What we believe",
        body: "We believe a seller shouldn't need a big budget or technical skill to look professional online. We believe trust matters more than reach — which is why Sella stores aren't open for anyone to stumble onto; buyers only find a store through a link or ID the seller shares themselves. And we believe in being upfront: what a buyer sees at checkout is exactly what they pay, and what a seller signs up for is exactly what they're charged. No hidden steps, no surprises."
      }
    ]}
  />;
}
