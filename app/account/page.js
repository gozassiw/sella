import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Landmark, Package, ShieldCheck, UserRound, WalletCards, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBuyerProfile, getBuyerWallet } from "@/lib/buyer";
import { formatNaira } from "@/lib/utils";
import UnfollowStoreButton from "@/components/UnfollowStoreButton";
import StoreAccessForm from "@/components/StoreAccessForm";
import VerifiedBadge from "@/components/VerifiedBadge";

function ProductCard({ product, store, featured = false }) {
  return <Link href={`/s/${store.slug}/p/${product.id}`} className="group block min-w-0">
    <div className={`relative overflow-hidden rounded-[20px] bg-surface ring-1 ring-transparent transition duration-300 group-hover:-translate-y-0.5 group-hover:ring-kola/15 ${featured ? "aspect-[1.35] sm:aspect-[1.5]" : "aspect-square"}`}>
      {product.image_urls?.[0] ? <Image src={product.image_urls[0]} alt={product.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.045]" /> : <div className="grid h-full place-items-center text-xs font-semibold text-muted">Product photo</div>}
      <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-ink shadow-sm">From {store.name}</span>
    </div>
    <p className={`mt-3 truncate font-bold transition-colors group-hover:text-kola ${featured ? "text-base" : "text-sm"}`}>{product.name}</p>
    <div className="mt-1.5 flex items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted"><span className="truncate">{store.name}</span>{store.paid_verification_approved && <VerifiedBadge className="shrink-0" />}</p>
      <p className={`shrink-0 font-extrabold text-kola ${featured ? "text-base" : "text-sm"}`}>{formatNaira(product.price)}</p>
    </div>
  </Link>;
}

function StoreAvatar({ store, size = "h-11 w-11" }) {
  return store.logo_url ? <Image src={store.logo_url} alt="" width={56} height={56} className={`${size} shrink-0 rounded-2xl object-cover`} /> : <span className={`${size} grid shrink-0 place-items-center rounded-2xl bg-surface text-lg font-extrabold text-ink`}>{store.name.charAt(0).toUpperCase()}</span>;
}

function VerifiedStoreCard({ store }) {
  return <div className="app-card flex min-w-0 items-center gap-3 p-3.5 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
    <Link href={`/s/${store.slug}`} className="group flex min-w-0 flex-1 items-center gap-3">
      <StoreAvatar store={store} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-extrabold"><span className="truncate">{store.name}</span>{store.paid_verification_approved && <VerifiedBadge className="shrink-0" />}</p>
        <p className="mt-1 truncate text-xs text-muted">{store.category || "Independent store"}</p>
        <p className="mt-2 text-[11px] font-bold text-success">● Connected</p>
      </div>
    </Link>
    <UnfollowStoreButton storeId={store.id} />
  </div>;
}

export default async function AccountPage() {
  const { supabase, user } = await getCurrentUser();
  const [profile, { data: follows }, wallet, { data: verifiedStores }] = await Promise.all([
    getBuyerProfile(user.id),
    supabase.from("buyer_store_follows").select("store_id,stores(id,name,slug,category,logo_url,brand_color,paid_verification_approved)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    getBuyerWallet(user.id),
    supabase.rpc("get_public_verified_store_ids"),
  ]);
  if (!profile) redirect("/account/setup");
  const trustedStores = (follows || []).map((item) => item.stores).filter(Boolean);
  const verifiedStoreIds = new Set((verifiedStores || []).map((item) => item.store_id));
  trustedStores.forEach((store) => { store.paid_verification_approved = verifiedStoreIds.has(store.id); });
  const { data: products } = trustedStores.length ? await supabase.from("products").select("id,store_id,name,price,image_urls,created_at").in("store_id", trustedStores.map((store) => store.id)).eq("is_active", true).order("created_at", { ascending: false }).limit(48) : { data: [] };
  const storeMap = new Map(trustedStores.map((store) => [store.id, store]));
  const feed = (products || []).map((product) => ({ product, store: storeMap.get(product.store_id) })).filter((item) => item.store);
  const firstName = profile?.full_name?.split(" ")?.[0] || user.email?.split("@")[0] || "there";
  const today = new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const quickLinks = [
    ["/account/wallet", "Wallet", "Add funds & transactions", WalletCards],
    ["/account/orders", "Orders", "Track your purchases", Package],
    ["/account/profile", "Profile & addresses", "Keep details up to date", UserRound],
    ["/account/reports", "Reports & safety", "Get help with a concern", ShieldCheck],
  ];

  return <div className="space-y-7 sm:space-y-9">
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="relative min-h-[244px] overflow-hidden rounded-[28px] bg-kola-dark p-6 text-white sm:p-8">
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div><p className="eyebrow text-mango">Sella buyer command center</p><h1 className="display mt-4 max-w-xl text-4xl leading-[.98] sm:text-5xl">Your trusted way to shop.</h1><p className="mt-4 max-w-md text-sm leading-6 text-white/70">Welcome back, {firstName}. Pick up where you left off or discover something new from stores you trust.</p></div>
          <p className="mt-8 text-xs font-bold text-white/55">{today}</p>
        </div>
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full border-[34px] border-white/10" />
        <div className="pointer-events-none absolute right-16 top-10 h-3 w-3 rounded-full bg-mango" />
      </div>
      <div className="app-card flex flex-col justify-between p-5">
        <div className="flex items-start justify-between"><div><p className="eyebrow text-kola">At a glance</p><p className="mt-2 text-sm text-muted">Your Sella network</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-kola-light text-kola"><ShieldCheck size={18} /></span></div>
        <div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-surface p-3"><p className="text-2xl font-extrabold text-ink">{trustedStores.length}</p><p className="mt-1 text-[11px] font-bold text-muted">Trusted stores</p></div><div className="rounded-2xl bg-surface p-3"><p className="text-2xl font-extrabold text-ink">{feed.length}</p><p className="mt-1 text-[11px] font-bold text-muted">Fresh products</p></div></div>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="space-y-4">
        <div className="flex items-end justify-between"><div><p className="eyebrow text-kola">Your money</p><h2 className="display mt-1 text-2xl">Wallet, ready when you are</h2></div><Link href="/account/wallet" className="hidden text-xs font-bold text-kola transition-opacity hover:opacity-70 sm:inline-flex sm:items-center">Open wallet <ArrowUpRight className="ml-1" size={14} /></Link></div>
        <div className="grid gap-4 md:grid-cols-[1.05fr_.95fr]">
          <div className="relative overflow-hidden rounded-[24px] bg-kola p-5 text-white transition duration-300 hover:shadow-lg sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-white/65">AVAILABLE BALANCE</p><p className="display mt-3 text-3xl sm:text-4xl">{formatNaira(wallet?.balance)}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-mango"><WalletCards size={20} /></span></div><div className="mt-8 flex flex-wrap gap-2"><Link href="/account/wallet" className="btn bg-white px-4 py-2.5 text-xs text-kola-dark">Fund wallet</Link><Link href="/account/wallet" className="btn border border-white/40 px-4 py-2.5 text-xs text-white">Transactions</Link></div></div>
          <div className="app-card p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-kola-light text-kola"><Landmark size={19} /></span><div><p className="text-sm font-extrabold">Dedicated account</p><p className="mt-1 text-xs leading-5 text-muted">Transfer in directly, no extra steps.</p></div></div>{wallet?.dedicated_account_number ? <><p className="mt-5 text-xl font-extrabold tracking-wide">{wallet.dedicated_account_number}</p><p className="mt-1 text-xs text-muted">{wallet.dedicated_bank_name || "Partner bank"} · {wallet.dedicated_account_name || "Sella wallet"}</p></> : <Link href="/account/wallet" className="btn-soft mt-5 inline-flex w-full text-xs">Create account number <ArrowRight size={15} /></Link>}<p className="mt-4 rounded-xl bg-kola-light px-3 py-2.5 text-xs leading-5 text-kola">Transfers to this account credit your Sella wallet.</p></div>
        </div>
      </div>
      <div className="app-card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div><p className="eyebrow text-kola">Move around</p><h2 className="display mt-1 text-lg">Quick access</h2></div><ArrowRight size={17} className="text-muted" /></div><div className="divide-y divide-line">{quickLinks.map(([href, label, detail, Icon]) => <Link key={href} href={href} className="group flex items-center gap-3 py-3 first:pt-2 last:pb-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-kola transition-colors group-hover:bg-kola-light"><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="mt-0.5 block truncate text-[11px] text-muted">{detail}</span></span><ArrowUpRight size={14} className="text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>)}</div></div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div id="my-trusted-stores" className="min-w-0"><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow text-kola">Your network</p><h2 className="display mt-1 text-2xl">Stores you trust</h2><p className="mt-1 text-xs text-muted">A private shelf of sellers you know.</p></div><span className="chip">{trustedStores.length} connected</span></div>{trustedStores.length ? <><div className="grid gap-3 sm:grid-cols-2">{trustedStores.slice(0, 4).map((store) => <VerifiedStoreCard key={store.id} store={store} />)}</div>{trustedStores.length > 4 && <details className="mt-4"><summary className="cursor-pointer list-none text-center text-sm font-bold text-kola underline">See more stores</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{trustedStores.slice(4).map((store) => <VerifiedStoreCard key={store.id} store={store} />)}</div></details>}</> : <div className="app-card p-5 text-sm text-muted">Stores you trust will appear here after you open a seller link.</div>}</div>
      <div className="space-y-4"><StoreAccessForm /><Link href="/account/reports" className="group flex items-start gap-3 rounded-[22px] border border-kola/15 bg-kola-light p-4 transition hover:border-kola/30"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-kola"><ShieldCheck size={17} /></span><span><span className="flex items-center gap-2 text-sm font-extrabold text-kola-dark">Shop with confidence <ArrowUpRight size={14} /></span><span className="mt-1 block text-xs leading-5 text-kola">Need help with a store or order? Reach Sella Safety.</span></span></Link></div>
    </section>

    <section id="trusted-stores" className="border-t border-line pt-7 sm:pt-9"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow text-kola">Made for you</p><h2 className="display mt-1 text-2xl sm:text-3xl">Fresh from your stores</h2><p className="mt-1 text-xs text-muted">New products from the sellers already in your corner.</p></div><Link href="#my-trusted-stores" className="text-xs font-bold text-kola transition-opacity hover:opacity-70">Manage trusted stores <ArrowRight className="ml-1 inline" size={13} /></Link></div>{feed.length ? <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">{feed.map(({ product, store }, index) => <div key={product.id} className={index === 0 ? "col-span-2 md:col-span-2" : ""}><ProductCard product={product} store={store} featured={index === 0} /></div>)}</div> : <div className="app-card mt-5 flex flex-col items-center px-6 py-10 text-center"><Zap size={22} className="text-kola" /><h3 className="mt-3 text-sm font-extrabold">Your shopping feed is empty</h3><p className="mt-2 max-w-sm text-xs leading-5 text-muted">Open a seller&apos;s store ID and tap Trust to start shopping.</p></div>}</section>
  </div>;
}
