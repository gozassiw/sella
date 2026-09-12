import Link from "next/link";
import { ArrowRight, PackageCheck, Store, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SellaBrand from "@/components/SellaBrand";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: admin, error: adminError } = await supabase.rpc("is_platform_admin");
    if (!adminError && admin === true) redirect("/admin");
    const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
    if (store) redirect("/dashboard");
    redirect("/account");
  }
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 lg:px-8">
          <SellaBrand />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/login?next=%2Fdashboard" className="rounded-xl px-3 py-2.5 text-sm font-bold text-kola sm:px-4">Seller login</Link>
            <Link href="/signup" className="btn-primary min-h-0 rounded-xl px-4 py-2.5">Create account</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1200px] px-4 pb-16 pt-4 sm:px-6 sm:pt-8 lg:px-8 lg:pb-24">
          <div className="rounded-[32px] bg-kola-dark px-6 py-14 text-white sm:px-12 sm:py-20 lg:px-20 lg:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/85"><span className="h-2 w-2 rounded-full bg-mango" /> Built for everyday commerce</span>
              <h1 className="display mt-7 text-[44px] leading-[1.02] sm:text-[64px]">Shop people you trust. Sell without the stress.</h1>
              <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-7 text-white/72 sm:text-base">Follow independent stores, discover products you love, pay from one wallet, and manage every order in one place.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/signup?next=%2Faccount%2Fsetup" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-mango px-5 py-3 text-sm font-extrabold text-kola-dark">Start shopping <ArrowRight size={17} /></Link>
                <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Open your store</Link>
              </div>
              <div className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-5 border-t border-white/15 pt-6 text-xs text-white/60">
                <div><strong className="block text-lg text-white">One</strong>buyer wallet</div>
                <div><strong className="block text-lg text-white">Live</strong>store feeds</div>
                <div><strong className="block text-lg text-white">Safe</strong>delivery flow</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-14 lg:py-20">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
              <div>
                <p className="eyebrow text-kola">For sellers</p>
                <h2 className="display mt-3 max-w-md text-3xl leading-tight sm:text-4xl">Your business, clear enough to run from your phone.</h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-muted">No clutter. See your money, orders, stock, customers, and storefront without jumping between apps.</p>
                <Link href="/signup" className="btn-primary mt-7">Create your store <ArrowRight size={16} /></Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[{ icon: WalletCards, title: "Know your money", body: "Available balance, held funds, and withdrawals in one wallet." }, { icon: PackageCheck, title: "Move orders", body: "See what needs delivery and confirm every handover." }, { icon: Store, title: "Own your audience", body: "Share your page and keep buyers coming back through follows." }].map(({ icon: Icon, title, body }, index) => <div key={title} className="app-card p-6"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${index === 1 ? "bg-mango text-kola-dark" : "bg-kola-light text-kola"}`}><Icon size={20} /></span><h3 className="mt-6 text-base font-extrabold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted">{body}</p></div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-7 rounded-[28px] bg-mango p-8 text-kola-dark sm:flex-row sm:items-center sm:p-10"><div><p className="text-xs font-extrabold uppercase tracking-[.14em]">Ready when you are</p><h2 className="display mt-3 text-3xl">Your next customer can start here.</h2></div><Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-kola-dark px-5 py-3 text-sm font-extrabold text-white">Open your store <ArrowRight size={17} /></Link></div>
        </section>
      </main>

      <footer className="border-t border-line bg-white"><div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><SellaBrand /><div className="flex flex-wrap gap-5"><Link href="/login?next=%2Fdashboard">Seller login</Link><Link href="/signup">Create account</Link></div><span>© {new Date().getFullYear()} Sella</span></div></footer>
    </div>
  );
}
