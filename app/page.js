import Link from "next/link";
import { BRAND } from "@/lib/config";

const features = [
  { title: "Your own online store", text: "Add products with photos and prices. Share one link on WhatsApp, Instagram and TikTok." },
  { title: "Stock that updates itself", text: "Know what is left, what is selling and what to restock before you run out." },
  { title: "Every sale in one place", text: "Website orders and the ones you close in DMs or in your shop, all recorded together." },
];

export default function Home() {
  return <div className="min-h-screen bg-white">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/" className="text-xl font-bold text-kola">{BRAND}</Link><nav className="flex items-center gap-2"><Link href="/login?next=%2Faccount" className="btn text-ink">Buyer login</Link><Link href="/signup?next=%2Faccount" className="btn-secondary hidden sm:inline-flex">Buyer sign up</Link><Link href="/login" className="btn text-ink hidden sm:inline-flex">Seller login</Link><Link href="/signup" className="btn-primary">Start selling</Link></nav></header>
    <main>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 md:pb-24 md:pt-20"><div className="max-w-3xl"><p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-kola">For Nigerian small businesses</p><h1 className="text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">Run your whole business from your phone.</h1><p className="mt-6 max-w-xl text-lg text-muted">Open an online store in minutes, take orders, record sales and track your stock. Built for sellers who do business on WhatsApp and Instagram.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/signup" className="btn-primary px-6 py-3 text-base">Create my store</Link><span className="self-center text-sm text-muted">14 days free. No card needed.</span></div></div>
        <div className="mt-12 grid gap-4 md:grid-cols-2"><div className="rounded-3xl bg-kola p-6 text-white"><p className="text-sm font-semibold uppercase tracking-wide text-white/70">Selling on Sella?</p><h2 className="mt-2 text-2xl font-bold">Create your store and share one link.</h2><Link href="/signup" className="mt-6 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-kola">Start selling</Link></div><div className="rounded-3xl border border-line bg-surface p-6"><p className="text-sm font-semibold uppercase tracking-wide text-kola">Shopping on Sella?</p><h2 className="mt-2 text-2xl font-bold">Create one buyer account for your orders.</h2><p className="mt-2 text-sm text-muted">When a seller sends you a store link, use the buyer buttons there to register, shop, and track delivery.</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/signup?next=%2Faccount" className="btn-primary">Create buyer account</Link><Link href="/login?next=%2Faccount" className="btn-secondary">Buyer login</Link></div></div></div>
      </section>
      <section className="border-t border-line bg-surface"><div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">{features.map((f) => <div key={f.title}><div className="mb-4 h-1.5 w-10 rounded-full bg-mango" /><h2 className="text-lg font-semibold">{f.title}</h2><p className="mt-2 text-muted">{f.text}</p></div>)}</div></section>
      <section className="mx-auto max-w-6xl px-5 py-16"><div className="rounded-3xl border border-line p-6 md:flex md:items-center md:justify-between md:p-10"><div><h2 className="text-2xl font-bold">Already received a store link?</h2><p className="mt-2 text-muted">Open the link, choose a product, then create a buyer account when you are ready to check out.</p></div><Link href="/signup?next=%2Faccount" className="btn-primary mt-5 md:mt-0">Register as a buyer</Link></div></section>
    </main><footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted">© {new Date().getFullYear()} {BRAND}</footer>
  </div>;
}
