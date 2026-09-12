import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Heart, PackageCheck, Search, Store, WalletCards } from "lucide-react";
import { getPublicHomeSamples } from "@/lib/storefront";
import { formatNaira } from "@/lib/utils";
import SellaBrand from "@/components/SellaBrand";

function ProductTile({ product, large = false }) {
  const store = product.stores;
  return (
    <Link href={`/s/${store?.slug || ""}/p/${product.id}`} className={`group block ${large ? "sm:row-span-2" : ""}`}>
      <div className={`relative overflow-hidden rounded-[22px] bg-white ${large ? "aspect-[4/5] sm:h-full" : "aspect-square"}`}>
        {product.image_urls?.[0] ? (
          <Image src={product.image_urls[0]} alt={product.name} fill sizes={large ? "(max-width: 640px) 100vw, 40vw" : "(max-width: 640px) 50vw, 25vw"} className="object-cover transition duration-300 group-hover:scale-[1.035]" />
        ) : <div className="grid h-full place-items-center text-xs font-semibold text-muted">Product photo</div>}
        <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-kola"><Heart size={16} strokeWidth={1.8} /></span>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-bold">{product.name}</p><p className="mt-1 truncate text-xs text-muted">{store?.name || "Independent store"}</p></div>
        <p className="shrink-0 text-sm font-extrabold text-kola">{formatNaira(product.price)}</p>
      </div>
    </Link>
  );
}

export default async function Home() {
  const { stores, products } = await getPublicHomeSamples();
  const featured = products.slice(0, 5);
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 lg:px-8">
          <SellaBrand />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/login?next=%2Faccount" className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-ink hover:bg-surface sm:inline-flex">Buyer login</Link>
            <Link href="/login?next=%2Fdashboard" className="rounded-xl px-3 py-2.5 text-sm font-bold text-kola sm:px-4">Seller login</Link>
            <Link href="/signup" className="btn-primary min-h-0 rounded-xl px-4 py-2.5">Get started</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1200px] px-4 pb-10 pt-4 sm:px-6 sm:pt-8 lg:px-8">
          <div className="overflow-hidden rounded-[32px] bg-kola-dark px-6 py-10 text-white sm:px-10 sm:py-14 lg:grid lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:gap-12 lg:px-14 lg:py-16">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/85"><span className="h-2 w-2 rounded-full bg-mango" /> Built for everyday commerce</span>
              <h1 className="display mt-7 text-[42px] leading-[1.03] sm:text-[54px]">Shop people you trust. Sell without the stress.</h1>
              <p className="mt-6 max-w-lg text-[15px] leading-7 text-white/72 sm:text-base">Follow independent stores, discover their newest products, pay from one wallet, and manage every order in one place.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup?next=%2Faccount%2Fsetup" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-mango px-5 py-3 text-sm font-extrabold text-kola-dark">Start shopping <ArrowRight size={17} /></Link>
                <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Open your store</Link>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-5 border-t border-white/15 pt-6 text-xs text-white/60">
                <div><strong className="block text-lg text-white">One</strong>buyer wallet</div>
                <div><strong className="block text-lg text-white">Live</strong>store feeds</div>
                <div><strong className="block text-lg text-white">Safe</strong>delivery flow</div>
              </div>
            </div>

            <div className="relative mt-10 lg:mt-0">
              <div className="rounded-[28px] bg-white p-4 text-ink sm:p-5" style={{ boxShadow: "0 28px 70px rgba(0,0,0,.22)" }}>
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-xs font-semibold text-muted">Good morning</p><p className="mt-1 text-lg font-extrabold">Fresh from your stores</p></div>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-kola-light text-kola"><Search size={18} /></span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {featured.slice(0, 2).map((product) => <ProductTile key={product.id} product={product} />)}
                  {!featured.length && <div className="col-span-2 grid aspect-[2/1] place-items-center rounded-2xl bg-surface text-sm font-semibold text-muted">Approved products appear here</div>}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-kola-light p-4">
                  <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-kola text-white"><BadgeCheck size={18} /></span><div><p className="text-sm font-bold">Follow a store</p><p className="mt-0.5 text-xs text-muted">New products come to you.</p></div></div>
                  <ArrowRight size={18} className="text-kola" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex items-end justify-between gap-5">
            <div><p className="eyebrow text-kola">Browse now</p><h2 className="display mt-3 text-3xl sm:text-4xl">Products worth finding.</h2></div>
            <Link href="/signup?next=%2Faccount%2Fsetup" className="hidden items-center gap-2 text-sm font-bold text-kola sm:flex">Create buyer account <ArrowRight size={16} /></Link>
          </div>
          {featured.length ? <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">{featured.map((product) => <ProductTile key={product.id} product={product} />)}</div> : <div className="mt-8 rounded-[24px] bg-white p-10 text-center text-sm text-muted">The first approved products will appear here.</div>}
        </section>

        <section className="bg-white py-14 lg:py-20">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
              <div><p className="eyebrow text-kola">For sellers</p><h2 className="display mt-3 max-w-md text-3xl leading-tight sm:text-4xl">Your business, clear enough to run from your phone.</h2><p className="mt-5 max-w-md text-sm leading-7 text-muted">No clutter. See your money, orders, stock, customers, and storefront without jumping between apps.</p><Link href="/signup" className="btn-primary mt-7">Create your store <ArrowRight size={16} /></Link></div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[{ icon: WalletCards, title: "Know your money", body: "Available balance, held funds, and withdrawals in one wallet." }, { icon: PackageCheck, title: "Move orders", body: "See what needs delivery and confirm every handover." }, { icon: Store, title: "Own your audience", body: "Share your page and keep buyers coming back through follows." }].map(({ icon: Icon, title, body }, index) => <div key={title} className="app-card p-6"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${index === 1 ? "bg-mango text-kola-dark" : "bg-kola-light text-kola"}`}><Icon size={20} /></span><h3 className="mt-6 text-base font-extrabold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted">{body}</p></div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex items-end justify-between gap-5"><div><p className="eyebrow text-kola">Independent stores</p><h2 className="display mt-3 text-3xl sm:text-4xl">Follow the people behind the products.</h2></div></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{stores.slice(0, 6).map((store) => <Link key={store.id} href={`/s/${store.slug}`} className="group flex items-center gap-4 rounded-[22px] border border-line bg-white p-4 hover:-translate-y-0.5 hover:border-kola/30" style={{ boxShadow: "var(--shadow-card)" }}>{store.logo_url ? <Image src={store.logo_url} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-2xl object-cover" /> : <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-kola text-base font-extrabold text-white">{store.name.charAt(0)}</span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{store.name}</p><p className="mt-1 truncate text-xs text-muted">{store.category || "Independent store"}</p></div><ArrowRight size={17} className="text-muted group-hover:text-kola" /></Link>)}</div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 pb-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-7 rounded-[28px] bg-mango p-8 text-kola-dark sm:flex-row sm:items-center sm:p-10"><div><p className="text-xs font-extrabold uppercase tracking-[.14em]">Ready when you are</p><h2 className="display mt-3 text-3xl">Your next customer can start here.</h2></div><Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-kola-dark px-5 py-3 text-sm font-extrabold text-white">Open your store <ArrowRight size={17} /></Link></div>
        </section>
      </main>

      <footer className="border-t border-line bg-white"><div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><SellaBrand /><div className="flex flex-wrap gap-5"><Link href="/login?next=%2Faccount">Buyer login</Link><Link href="/login?next=%2Fdashboard">Seller login</Link><Link href="/signup">Create account</Link></div><span>© {new Date().getFullYear()} Sella</span></div></footer>
    </div>
  );
}
