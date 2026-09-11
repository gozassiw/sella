import Link from "next/link";
import { BRAND } from "@/lib/config";

const features = [
  { title: "Your own online store", text: "Add products with photos and prices. Share one link on WhatsApp, Instagram and TikTok." },
  { title: "Stock that updates itself", text: "Know what's left, what's selling and what to restock before you run out." },
  { title: "Every sale in one place", text: "Website orders and the ones you close in DMs or in your shop, all recorded together." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-xl font-bold text-kola">{BRAND}</span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn text-ink">Log in</Link>
          <Link href="/signup" className="btn-primary">Start free trial</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:pt-20">
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
            Run your whole business from your phone.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Open an online store in minutes, take orders, record sales and track your stock.
            Built for Nigerian sellers who do business on WhatsApp and Instagram.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">Create my store</Link>
            <span className="self-center text-sm text-muted">14 days free. No card needed.</span>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <div className="mb-4 h-1.5 w-10 rounded-full bg-mango" />
                <h2 className="text-lg font-semibold">{f.title}</h2>
                <p className="mt-2 text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted">© {new Date().getFullYear()} {BRAND}</footer>
    </div>
  );
}
