"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Heart,
  LockKeyhole,
  Menu,
  PieChart,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

const posters = [
  { image: "/marketing/moniused-launch.png", kicker: "Launch", title: "Where did your moni go?", copy: "MoniUsed is live." },
  { image: "/marketing/moniused-speed.png", kicker: "Speed", title: "Add a spend in 5 seconds.", copy: "Amount. Category. Save." },
  { image: "/marketing/moniused-insights.png", kicker: "Insights", title: "See where your moni went.", copy: "Your spending story, made clear." },
  { image: "/marketing/moniused-salary-day.png", kicker: "Relatable", title: "Salary day vs 5 days later.", copy: "Know where your moni goes." },
  { image: "/marketing/moniused-privacy.png", kicker: "Privacy", title: "Your money. Your eyes only.", copy: "Private by design." },
];

function Mark({ white = false }) {
  return (
    <span className={`brand-mark ${white ? "brand-mark-white" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none"><path d="M7 27.5 13.6 13l6.8 8.3L26.9 7 34 14.4 27.1 28l-6.7-8.2-6.3 12.4L7 27.5Z" fill="currentColor" /><path d="M8 19.4 13.4 7 20 15.2 26.5 2.8 34 10.5l-7 13.6-6.7-8.2-5.1 10.2L8 19.4Z" fill="currentColor" opacity=".85" /></svg>
    </span>
  );
}

function Logo({ light = false }) {
  return <a href="#top" className={`marketing-logo ${light ? "marketing-logo-light" : ""}`} aria-label="MoniUsed home"><Mark white={light} /><span><b>Moni</b><strong>Used</strong></span></a>;
}

function PhoneMockup() {
  return (
    <div className="phone-wrap" aria-label="A preview of the MoniUsed app">
      <div className="phone-shadow" />
      <div className="phone-shell">
        <div className="phone-top"><span>10:31</span><div><span className="signal" /><span className="wifi" /><span className="battery" /></div></div>
        <div className="phone-brand"><Logo /></div>
        <div className="phone-body">
          <p className="phone-greeting">Good morning, Oweipade</p>
          <div className="phone-balance"><span>Left in September</span><b>₦1,407,000</b><div><em>↓ Money in<strong>₦1,500,000</strong></em><em>↑ Money out<strong>₦93,000</strong></em></div></div>
          <div className="phone-actions"><span>− Add expense</span><span>+ Add income</span></div>
          <p className="phone-section-title">Recent</p>
          <div className="phone-entry"><span className="mini-food">Ψ</span><div><b>ate at beeland</b><small>Food · Today</small></div><strong>−₦93,000</strong></div>
          <div className="phone-entry muted-entry"><span className="mini-salary">▥</span><div><b>salary</b><small>Salary · Today</small></div><strong>+₦1,500,000</strong></div>
        </div>
        <div className="phone-nav"><span className="active">⌂<small>Home</small></span><span>☷<small>Entries</small></span><span>◔<small>Insights</small></span><span>♙<small>Profile</small></span></div>
      </div>
    </div>
  );
}

function PosterCard({ poster, index }) {
  return <article className={`poster-card poster-${index}`}><div className="poster-image-wrap"><img src={poster.image} alt={`${poster.kicker} MoniUsed poster: ${poster.title}`} /></div><div className="poster-card-copy"><span>{poster.kicker}</span><h3>{poster.title}</h3><p>{poster.copy}</p><a href={poster.image} target="_blank" rel="noreferrer">Open poster <ArrowRight size={15} /></a></div></article>;
}

function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return <header className="marketing-header"><div className="marketing-container header-inner"><Logo /><nav className={`marketing-nav ${open ? "is-open" : ""}`}><a href="#why" onClick={() => setOpen(false)}>Why MoniUsed</a><a href="#how" onClick={() => setOpen(false)}>How it works</a><a href="#posters" onClick={() => setOpen(false)}>Campaign</a><a href="#download" className="header-cta" onClick={() => setOpen(false)}>Get MoniUsed <ArrowRight size={15} /></a></nav><button className="header-menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X size={23} /> : <Menu size={23} />}</button></div></header>;
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  return <main className="marketing-site" id="top">
    <MarketingHeader />
    <section className="marketing-hero">
      <div className="marketing-container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow-pill"><Sparkles size={15} /> Made for your everyday moni</div>
          <h1>Where did your <span>moni</span> go?</h1>
          <p className="hero-lede">MoniUsed helps you track what comes in, what goes out, and what&apos;s left — so your salary doesn&apos;t mysteriously disappear before month-end.</p>
          <div className="hero-actions"><a className="button button-dark" href="#download">Start tracking free <ArrowRight size={18} /></a><a className="text-link" href="#how">See how it works <ChevronRight size={17} /></a></div>
          <div className="hero-proof"><div className="proof-dots"><i /><i /><i /><i /></div><span>Simple enough for salary earners, students and side hustlers.</span></div>
        </div>
        <div className="hero-visual"><div className="lemon-sticker">salary<br /><b>don land</b></div><PhoneMockup /><div className="hero-note"><PieChart size={18} /><span><b>See your patterns.</b><small>Not just your balance.</small></span></div></div>
      </div>
    </section>

    <section className="trust-strip"><div className="marketing-container trust-grid"><div><LockKeyhole size={20} /><span><b>No bank login</b><small>Record only what you choose</small></span></div><div><Zap size={20} /><span><b>Add in seconds</b><small>Amount → category → save</small></span></div><div><ShieldCheck size={20} /><span><b>Private by design</b><small>Your moni, your eyes only</small></span></div><div><Download size={20} /><span><b>Free to use</b><small>Install from the website</small></span></div></div></section>

    <section className="problem-section" id="why"><div className="marketing-container problem-grid"><div><span className="section-kicker">Sound familiar?</span><h2>Salary came in on the 25th. By the 5th, it&apos;s gone.</h2><p>You know you spent it somewhere. You just don&apos;t know where. MoniUsed turns that mystery into something you can actually see.</p></div><div className="problem-list"><div><span>01</span><b>Too many little spends</b><p>Lunch, data, rides, transfers. They add up quietly.</p></div><div><span>02</span><b>Nothing to look back on</b><p>By month-end, the details have already blurred.</p></div><div><span>03</span><b>No shame. Just clarity.</b><p>Awareness is the first step to keeping more of your moni.</p></div></div></div></section>

    <section className="features-section" id="how"><div className="marketing-container"><div className="center-heading"><span className="section-kicker">Your money, made visible</span><h2>Small steps. Clearer choices.</h2><p>MoniUsed is intentionally simple. No bank integrations, no confusing charts, no lectures about what you spend.</p></div><div className="feature-grid"><article className="feature-card feature-violet"><span className="feature-icon"><Plus size={22} /></span><h3>Add a spend in seconds</h3><p>Log an expense or income with just the essentials. Keep moving.</p><div className="feature-demo"><span>₦2,500</span><b>Lunch</b><i>Food</i><Check size={18} /></div></article><article className="feature-card feature-lemon"><span className="feature-icon"><PieChart size={22} /></span><h3>See where it went</h3><p>Spot your biggest categories, daily average and spending patterns.</p><div className="bar-demo"><i style={{ height: "82%" }} /><i style={{ height: "54%" }} /><i style={{ height: "68%" }} /><i style={{ height: "34%" }} /><i style={{ height: "48%" }} /><i style={{ height: "24%" }} /></div></article><article className="feature-card feature-white"><span className="feature-icon"><Heart size={22} /></span><h3>Build awareness, not guilt</h3><p>Track your real life: family support, data, outings, food and everything in between.</p><div className="category-pills"><span>Food</span><span>Data</span><span>Family</span><span>Fun</span></div></article></div></div></section>

    <section className="steps-section"><div className="marketing-container steps-grid"><div className="steps-intro"><span className="section-kicker">How it works</span><h2>From “where did it go?” to “I know.”</h2><a className="button button-violet" href="#download">Try it for free <ArrowRight size={17} /></a></div><div className="step-list"><div><span>1</span><div><h3>Record your moni</h3><p>Add money in or money out as it happens.</p></div></div><div><span>2</span><div><h3>Give it a category</h3><p>Food, transport, data, bills — make the pattern visible.</p></div></div><div><span>3</span><div><h3>Check your insights</h3><p>Look back without judgement and make your next choice with context.</p></div></div></div></div></section>

    <section className="posters-section" id="posters"><div className="marketing-container"><div className="poster-heading"><div><span className="section-kicker">The MoniUsed campaign</span><h2>Made for real life in Nigeria.</h2><p>Five reminders for the moments we all know: payday, buka lunch, data runs and that “what happened?” feeling.</p></div><a className="text-link" href="mailto:hello@moniused.com">Work with us <ArrowRight size={17} /></a></div><div className="posters-grid">{posters.map((poster, index) => <PosterCard key={poster.kicker} poster={poster} index={index} />)}</div></div></section>

    <section className="download-section" id="download"><div className="marketing-container download-panel"><div className="download-copy"><span className="section-kicker">Ready when you are</span><h2>Let&apos;s keep an eye on your moni.</h2><p>MoniUsed is free, private and made for the way Nigerians actually spend. Get started straight from your phone.</p><div className="download-points"><span><Check size={16} /> Free forever</span><span><Check size={16} /> No bank login</span><span><Check size={16} /> iPhone &amp; Android</span></div></div><div className="download-form"><div className="download-icon"><Smartphone size={28} /></div><h3>Get the launch link</h3><p>Leave your email and we&apos;ll send you the easiest way to install MoniUsed.</p>{submitted ? <div className="success-message"><Check size={20} /><b>You&apos;re on the list.</b><span>We&apos;ll be in touch soon.</span></div> : <form onSubmit={handleSubmit}><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" required /><button className="button button-dark" type="submit">Send me the link <ArrowRight size={17} /></button></form>}<small>We won&apos;t spam you. Promise.</small></div></div></section>

    <footer className="marketing-footer"><div className="marketing-container footer-top"><Logo light /><div className="footer-tagline">See where your moni went.</div><div className="footer-links"><a href="#why">Why MoniUsed</a><a href="#how">How it works</a><a href="#posters">Campaign</a><a href="mailto:hello@moniused.com">Contact</a></div></div><div className="marketing-container footer-bottom"><span>© 2026 MoniUsed. Made for everyday Nigerians.</span><span>Free. No bank login needed.</span></div></footer>
  </main>;
}
