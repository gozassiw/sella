import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SellaBrand from "@/components/SellaBrand";

export default function InfoPage({ eyebrow, title, intro, sections }) {
  return <main className="seller-homepage info-page"><header className="seller-site-header demo-page-header"><div className="seller-wrap seller-nav"><SellaBrand /><Link href="/" className="seller-button seller-button-outline seller-button-sm"><ArrowLeft size={16} /> Back home</Link></div></header><div className="seller-wrap info-page-wrap"><p className="seller-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="seller-lede">{intro}</p><div className="info-page-sections">{sections.map((section) => <section key={section.heading} className="info-page-section"><h2>{section.heading}</h2><p>{section.body}</p></section>)}</div><Link href="/book-a-demo" className="seller-button seller-button-primary">Book a Demo</Link></div></main>;
}
