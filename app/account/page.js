import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, CircleHelp, Landmark, Package, ShoppingBag, Store, WalletCards, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureBuyerWallet } from "@/lib/buyer";
import { formatNaira } from "@/lib/utils";
import UnfollowStoreButton from "@/components/UnfollowStoreButton";
import StoreAccessForm from "@/components/StoreAccessForm";
import VerifiedBadge from "@/components/VerifiedBadge";

function ProductCard({ product, store }) {
  return <Link href={`/s/${store.slug}/p/${product.id}`} className="group block min-w-0"><div className="relative aspect-square overflow-hidden rounded-2xl bg-surface">{product.image_urls?.[0] ? <Image src={product.image_urls[0]} alt={product.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-[1.035]" /> : <div className="grid h-full place-items-center text-xs font-semibold text-muted">Product photo</div>}</div><p className="mt-3 truncate text-sm font-bold">{product.name}</p><div className="mt-1 flex items-center justify-between gap-2"><p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted"><span className="truncate">{store.name}</span>{store.paid_verification_approved && <VerifiedBadge className="shrink-0" />}</p><p className="shrink-0 text-sm font-extrabold text-kola">{formatNaira(product.price)}</p></div></Link>;
}

function StoreAvatar({ store, size = "h-11 w-11" }) {
  return store.logo_url ? <Image src={store.logo_url} alt="" width={56} height={56} className={`${size} shrink-0 rounded-2xl object-cover`} /> : <span className={`${size} grid shrink-0 place-items-center rounded-2xl bg-surface text-lg font-extrabold text-ink`}>{store.name.charAt(0).toUpperCase()}</span>;
}

function VerifiedStoreCard({ store }) {
  return <Link href={`/s/${store.slug}`} className="app-card group flex items-center gap-3 p-3.5 transition hover:-translate-y-0.5"><StoreAvatar store={store} /><div className="min-w-0 flex-1"><p className="flex items-center gap-1 text-sm font-extrabold"><span className="truncate">{store.name}</span>{store.paid_verification_approved && <VerifiedBadge className="shrink-0" />}</p><p className="mt-1 truncate text-xs text-muted">{store.category || "Independent store"}</p><p className="mt-2 text-[11px] font-bold text-success">● Connected</p></div></Link>;
}

export default async function AccountPage() {
  const { supabase, user } = await getCurrentUser();
  const [{ data: profile }, { data: follows }] = await Promise.all([
    supabase.from("buyer_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("buyer_store_follows").select("store_id,stores(id,name,slug,category,logo_url,brand_color,paid_verification_approved)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!profile) redirect("/account/setup");
  let wallet = null;
  try { wallet = await ensureBuyerWallet(user); } catch { wallet = null; }
  const trustedStores = (follows || []).map((item) => item.stores).filter(Boolean);
  const activeBadgeStates = await Promise.all(trustedStores.map(async (store) => {
    const { data } = await supabase.rpc("store_has_active_paid_verification", { p_store_id: store.id });
    return [store.id, data === true];
  }));
  const badgeMap = new Map(activeBadgeStates);
  trustedStores.forEach((store) => { store.paid_verification_approved = badgeMap.get(store.id) === true; });
  const { data: products } = trustedStores.length ? await supabase.from("products").select("id,store_id,name,price,image_urls,created_at").in("store_id", trustedStores.map((store) => store.id)).eq("is_active", true).order("created_at", { ascending: false }).limit(48) : { data: [] };
  const storeMap = new Map(trustedStores.map((store) => [store.id, store]));
  const feed = (products || []).map((product) => ({ product, store: storeMap.get(product.store_id) })).filter((item) => item.store);
  const firstName = profile?.full_name?.split(" ")?.[0] || user.email?.split("@")[0] || "there";
  const today = new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return <div className="space-y-7 sm:space-y-9">
    <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-kola">Buyer workspace</p><h1 className="display mt-2 text-3xl sm:text-4xl">Welcome back, {firstName}.</h1><p className="mt-2 text-sm text-muted">Shop trusted stores, track orders and manage your wallet.</p></div><p className="hidden text-right text-xs text-muted sm:block">{today}<br /><span className="mt-1 inline-block font-bold">A good day to shop on Sella.</span></p></section>
    <section className="grid gap-4 xl:grid-cols-[1.05fr_1fr_.86fr]">
      <div className="relative overflow-hidden rounded-[24px] bg-kola-dark p-5 text-white sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-white/65">WALLET BALANCE</p><p className="display mt-3 text-3xl sm:text-4xl">{formatNaira(wallet?.balance)}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-mango"><WalletCards size={20} /></span></div><div className="mt-7 flex gap-2"><Link href="/account/wallet" className="btn bg-white px-4 py-2.5 text-xs text-kola-dark">Fund wallet</Link><Link href="/account/wallet" className="btn border border-white/40 px-4 py-2.5 text-xs text-white">View details</Link></div></div>
      <div className="app-card p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-kola-light text-kola"><Landmark size={19} /></span><div className="min-w-0"><p className="text-sm font-extrabold">Your Sella account number</p><p className="mt-1 text-xs text-muted">Use it to fund your wallet by bank transfer.</p></div></div>{wallet?.dedicated_account_number ? <><p className="mt-5 text-xl font-extrabold tracking-wide">{wallet.dedicated_account_number}</p><p className="mt-1 text-xs text-muted">{wallet.dedicated_bank_name || "Partner bank"} · {wallet.dedicated_account_name || "Sella wallet"}</p></> : <Link href="/account/wallet" className="btn-soft mt-5 inline-flex w-full text-xs">Create account number <ArrowRight size={15} /></Link>}<p className="mt-4 rounded-xl bg-kola-light px-3 py-2.5 text-xs leading-5 text-kola">Transfers to this account credit your Sella wallet.</p></div>
      <div className="rounded-[24px] bg-kola-light p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-kola"><ShoppingBag size={19} /></span><div><p className="text-lg font-extrabold text-kola-dark">Shop smarter with Sella</p><p className="mt-2 text-xs leading-5 text-kola">Open a store you know using its link or Store ID.</p></div></div><Link href="#my-trusted-stores" className="btn-primary mt-6 flex w-full text-xs">My Trusted Stores <ArrowRight size={15} /></Link></div>
    </section>
    <section id="my-trusted-stores"><div className="mb-3 flex items-center justify-between"><div><p className="eyebrow text-kola">Your network</p><h2 className="display mt-1 text-xl">My Trusted Stores</h2></div><span className="text-xs font-bold text-kola">{trustedStores.length} stores</span></div>{trustedStores.length ? <div className="grid gap-3 md:grid-cols-3">{trustedStores.map((store) => <div key={store.id} className="min-w-0"><VerifiedStoreCard store={store} /><div className="mt-2 px-2"><UnfollowStoreButton storeId={store.id} /></div></div>)}</div> : <div className="app-card p-5 text-sm text-muted">Stores you trust will appear here after you open a seller link.</div>}</section>
    <section><div className="space-y-3"><div className="app-card p-4"><h2 className="text-base font-extrabold">Quick actions</h2>{[{ icon: Store, label: "My Trusted Stores", detail: "Open trusted stores", href: "#store-access" }, { icon: WalletCards, label: "Top up wallet", detail: "Fund your account", href: "/account/wallet" }, { icon: Package, label: "Track an order", detail: "Check delivery status", href: "/account/orders" }].map(({ icon: Icon, label, detail, href }) => <Link key={label} href={href} className="flex items-center gap-3 border-b border-line py-3 last:border-0"><span className="grid h-9 w-9 place-items-center rounded-xl bg-kola-light text-kola"><Icon size={16} /></span><span className="min-w-0 flex-1"><b className="block text-xs">{label}</b><small className="mt-0.5 block truncate text-[10px] text-muted">{detail}</small></span><ChevronRight size={15} className="text-muted" /></Link>)}</div><div className="app-card bg-kola-light p-4"><CircleHelp size={20} className="text-kola" /><p className="mt-3 text-sm font-extrabold text-kola-dark">Need help?</p><p className="mt-1 text-xs leading-5 text-kola">Get support with orders, payments or your account.</p><Link href="/faq" className="mt-3 inline-flex text-xs font-bold text-kola underline">Open help centre</Link></div></div></section>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">Have a concern about a store or order?</p><Link href="/account/reports" className="text-sm font-bold text-kola underline">Reports &amp; Safety</Link></div>
    <StoreAccessForm />
    <section id="trusted-stores"><div className="flex items-end justify-between"><div><p className="eyebrow text-kola">Shopping feed</p><h2 className="display mt-1 text-xl">Latest from your stores</h2></div></div>{feed.length ? <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">{feed.map(({ product, store }) => <ProductCard key={product.id} product={product} store={store} />)}</div> : <div className="app-card mt-4 flex flex-col items-center px-6 py-10 text-center"><Zap size={22} className="text-kola" /><h3 className="mt-3 text-sm font-extrabold">Your shopping feed is empty</h3><p className="mt-2 max-w-sm text-xs leading-5 text-muted">Open a seller&apos;s store ID and tap Trust to start shopping.</p></div>}</section>
  </div>;
}
