"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import SellaBrand from "@/components/SellaBrand";
import { useHomepageMode } from "@/components/HomepageMode";

export default function HomepageTop({ signupHref = "/signup" }) {
  const { mode, setMode } = useHomepageMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const demoSelected = mode === "demo";

  return (
    <>
      <header className="seller-site-header">
        <div className="seller-header-tabs" role="tablist" aria-label="Homepage sections">
          <button type="button" role="tab" aria-selected={!demoSelected} className={!demoSelected ? "is-active" : ""} onClick={() => setMode("home")}>Home</button>
          <button type="button" role="tab" aria-selected={demoSelected} className={demoSelected ? "is-active" : ""} onClick={() => setMode("demo")}>Book a Demo</button>
        </div>
        <div className="seller-wrap seller-nav">
          <SellaBrand />
          <nav className="seller-navlinks" aria-label="Main navigation">
            <Link className="seller-plain-link" href="/login?next=%2Fdashboard">Login</Link>
            <Link className="seller-button seller-button-outline seller-button-sm" href={signupHref}>Create account</Link>
            <button type="button" className="seller-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}><Menu size={22} /></button>
          </nav>
        </div>
        <div className="seller-company-bar"><p>Sella is owned and operated by Jojokev Digital - BN9832074</p></div>
      </header>
      {menuOpen && <div className="seller-menu-popover" role="dialog" aria-modal="true" aria-label="Sella menu">
          <div className="seller-menu-inner">
            <div className="seller-menu-head"><div><p className="seller-eyebrow">Explore Sella</p><p className="seller-menu-title">A clearer way to run your store.</p></div><button type="button" className="seller-menu-button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={22} /></button></div>
            <nav className="seller-menu-links" aria-label="Information pages">
              <Link href="/about" onClick={() => setMenuOpen(false)}>About Us <ArrowRight size={17} /></Link>
              <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>How It Works <ArrowRight size={17} /></Link>
              <Link href="/faq" onClick={() => setMenuOpen(false)}>FAQ <ArrowRight size={17} /></Link>
            </nav>
          </div>
      </div>}
      <section className="seller-hero">
        <div className={`seller-wrap seller-hero-grid ${demoSelected ? "seller-hero-demo-grid" : ""}`}>
          <div>
            <div className="seller-eyebrow">{demoSelected ? "See Sella in person" : "For sellers"}</div>
            <h1>{demoSelected ? "Not confident with technology? We can show you." : "Your business, clear enough to run from your phone."}</h1>
            <p className="seller-lede">{demoSelected ? "Book a free 30-minute WhatsApp call and our team will personally walk you through setting up your store." : "No more scattered chats and screenshots. See your storefront, orders, stock, and money in one simple place."}</p>
            <div className="seller-hero-ctas">
              {demoSelected ? <><Link className="seller-button seller-button-primary" href={signupHref}>Try Sella <ArrowRight size={17} /></Link><Link className="seller-button seller-button-outline" href="/book-a-demo">Book a Demo <ArrowRight size={17} /></Link></> : <Link className="seller-button seller-button-primary" href={signupHref}>Create your store <ArrowRight size={17} /></Link>}
            </div>
          </div>
          {!demoSelected && <div className="seller-wallet-card">
            <div className="seller-wallet-label">Available balance</div>
            <div className="seller-wallet-amount">₦186,400</div>
            <div style={{ marginTop: 18 }}>
              <div className="seller-row"><div><div className="seller-name">Order #5AD8</div><div className="seller-sub">Delivered · Chioma O.</div></div><div className="seller-amt">+₦18,500</div></div>
              <div className="seller-row"><div><div className="seller-name">Withdrawal</div><div className="seller-sub">Sent to GTBank ••4521</div></div><div className="seller-amt">−₦40,000</div></div>
            </div>
          </div>}
        </div>
      </section>
    </>
  );
}
