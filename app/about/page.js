import InfoPage from "@/components/InfoPage";

export const metadata = { title: "About Us — Sella" };

export default function AboutPage() {
  return <InfoPage
    eyebrow="ABOUT SELLA"
    title="A clearer way to run your store."
    intro="Sella is a commerce and business-management platform that connects independent sellers with their customers. Sellers manage their own stores, products, orders and deliveries, while Sella provides the technology for storefronts, payments and business management."
    sections={[
      {
        heading: "Who we are",
        body: "Jojokev Digital is a Nigerian commerce company. We build Sella, a platform that gives small business owners and independent sellers their own online store — without needing to know how to code, hire a developer, or pay for a website they don't fully understand. Most Nigerian sellers already have real customers and real sales; what they've been missing is a proper place to run the business behind those sales."
      },
      {
        heading: "What we believe",
        body: "Sella supports business-to-consumer transactions without a public marketplace discovery feed. Buyers choose independent stores using a shared store link or Store ID and the Trust Store feature. Sellers are responsible for their products, descriptions, fulfilment, deliveries and applicable refunds. Sella remains responsible for its platform, its payment-related processes and complaints within its responsibilities."
      }
    ]}
  />;
}
