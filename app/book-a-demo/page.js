import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import SellaBrand from "@/components/SellaBrand";
import DemoBookingForm from "@/components/DemoBookingForm";

export const metadata = { title: "Book a Demo — Sella" };

export default function BookADemoPage() {
  return <main className="seller-homepage demo-page">
    <header className="seller-site-header demo-page-header"><div className="seller-wrap seller-nav"><SellaBrand /><Link href="/" className="seller-button seller-button-outline seller-button-sm"><ArrowLeft size={16} /> Back home</Link></div></header>
    <div className="seller-wrap demo-page-wrap">
      <section className="demo-intro"><p className="seller-eyebrow">Free guided setup</p><h1>Book a demo with Sella.</h1><p className="seller-lede">This is a free 30-minute guided call over WhatsApp. Our team will personally walk you through setting up your store — especially if you&apos;re not confident with technology and would rather be shown than figure it out alone.</p><div className="demo-whatsapp-note"><MessageCircle size={18} /><span>We&apos;ll use WhatsApp to confirm your selected day and time.</span></div></section>
      <DemoBookingForm />
    </div>
  </main>;
}
