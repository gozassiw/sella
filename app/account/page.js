import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, Search, Store, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/utils";

function ProductCard({ product, store }) {
  return (
    <Link href={`/s/${store.slug}/p/${product.id}`} className="group block min-w-0">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-white">
        {product.image_urls?.[0] ? <Image src={product.image_urls[0]} alt={product.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-[1.035]" /> : <div className="grid h-full place-items-center text-xs font-semibold text-muted">Product photo</div>}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-kola">NEW</span>
      </div>
      <p className="mt-3 truncate text-sm font-bold">{product.name}</p>
      <div className="mt-1 flex items-center justify-between gap-2"><p className="truncate text-xs text-muted">{store.name}</p><p className="shrink-0 text-sm font-extrabold text-kola">{formatNaira(product.price)}</p></div>
    </Link>
  );
}

export default async function AccountPage({ searchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const query = String(searchParams?.q || "").trim();
  const [{ data: profile }, { data: wallet }, { data: orders }, { data: follows }, { data: discoverStores }] = await Promise.all([
    supabase.from("buyer_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("buyer_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("orders").select("id,order_number,total,status,payment_status,created_at,stores(name,slug)").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("buyer_store_follows").select("store_id,stores(id,name,slug,category,logo_url,brand_color)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("stores").select("id,name,slug,category,logo_url,brand_color").eq("is_published", true).eq("approval_status", "approved").ilike("name", query ? `%${query}%` : "%").order("created_at", { ascending: false }).limit(24),
  ]);
  const followedStores = (follows || []).map((item) => item.stores).filter(Boolean);
  const followedIds = new Set(followedStores.map((store) => store.id));
  const storesToDiscover = (discoverStores || []).filter((store) => !followedIds.has(store.id));
  const allStoreMap = new Map([...(discoverStores || []), ...followedStores].map((store) => [store.id, store]));
  const followedStoreIds = followedStores.map((store) => store.id);
  const discoveryIds = (discoverStores || []).map((store) => store.id);
  const productIds = followedStoreIds.length ? followedStoreIds : discoveryIds;
  const { data: products } = productIds.length ? await supabase.from("products").select("id,store_id,name,price,image_urls,created_at").in("store_id", productIds).eq("is_active", true).order("created_at", { ascending: false }).limit(40) : { data: [] };
  const feed = (products || []).map((product) => ({ product, store: allStoreMap.get(product.store_id) })).filter((item) => item.store);
  const firstName = profile?.full_name?.split(" ")?.[0] || user.email?.split("@")[0] || "there";

  return (
    <div className="space-y-10">
      <section className="flex items-center justify-between gap-4">
        <div><p className="text-xs font-semibold text-muted">Welcome back</p><h1 className="display mt-1 text-2xl sm:text-3xl">Hi, {firstName}</h1></div>
        <Link href="/account/wallet" className="flex items-center gap-3 rounded-2xl bg-kola px-4 py-3 text-white" style={{ boxShadow: "0 8px 22px rgba(19,122,82,.2)" }}><WalletCards size={19} /><div><p className="text-[10px] font-semibold text-white/70">Wallet</p><p className="text-sm font-extrabold">{formatNaira(wallet?.balance)}</p></div></Link>
      </section>

      <form action="/account" className="relative">
        <Search size={18} className="absolute left-4 top-4 text-muted" />
        <input name="q" defaultValue={query} className="input h-[52px] rounded-2xl pl-12 pr-24" placeholder="Search stores and products" aria-label="Search stores" />
        <button className="absolute right-1.5 top-1.5 rounded-xl bg-kola px-4 py-2.5 text-xs font-extrabold text-white">Search</button>
      </form>

      {followedStores.length > 0 && <section><div className="flex items-center justify-between"><h2 className="text-base font-extrabold">Stores you follow</h2><Link href="/account/profile" className="text-xs font-bold text-kola">Manage</Link></div><div className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">{followedStores.map((store) => <Link key={store.id} href={`/s/${store.slug}`} className="flex w-[76px] shrink-0 flex-col items-center gap-2 text-center">{store.logo_url ? <Image src={store.logo_url} alt="" width={58} height={58} className="h-[58px] w-[58px] rounded-[20px] object-cover" /> : <span className="grid h-[58px] w-[58px] place-items-center rounded-[20px] bg-kola text-base font-extrabold text-white">{store.name.charAt(0)}</span>}<span className="w-full truncate text-[11px] font-bold">{store.name}</span></Link>)}</div></section>}

      <section>
        <div className="flex items-end justify-between gap-4"><div><p className="eyebrow text-kola">{followedStoreIds.length ? "Following" : "Discover"}</p><h2 className="display mt-2 text-2xl sm:text-3xl">{followedStoreIds.length ? "Latest from your stores" : "Products picked for you"}</h2></div></div>
        {feed.length ? <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4">{feed.map(({ product, store }) => <ProductCard key={product.id} product={product} store={store} />)}</div> : <div className="app-card mt-5 flex flex-col items-center px-6 py-12 text-center"><span className="grid h-14 w-14 place-items-center rounded-[20px] bg-kola-light text-kola"><Store size={23} /></span><h3 className="mt-5 text-base font-extrabold">Your feed starts with a follow</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted">Find a store you like, tap Follow, and their newest products will appear here.</p><Link href="#discover" className="btn-primary mt-5">Find stores <ArrowRight size={16} /></Link></div>}
      </section>

      <section id="discover">
        <div className="flex items-center justify-between"><div><p className="eyebrow text-kola">More to explore</p><h2 className="display mt-2 text-2xl">Discover stores</h2></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{storesToDiscover.slice(0, 8).map((store) => <Link key={store.id} href={`/s/${store.slug}`} className="app-card flex items-center gap-4 p-4 hover:-translate-y-0.5">{store.logo_url ? <Image src={store.logo_url} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-[18px] object-cover" /> : <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-kola text-sm font-extrabold text-white">{store.name.charAt(0)}</span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{store.name}</p><p className="mt-1 truncate text-xs text-muted">{store.category || "Independent store"}</p></div><ChevronRight size={18} className="text-muted" /></Link>)}</div>
      </section>

      <section>
        <div className="flex items-center justify-between"><h2 className="text-base font-extrabold">Recent orders</h2><Link href="/account/orders" className="text-xs font-bold text-kola">See all</Link></div>
        <div className="app-card mt-4 divide-y divide-line overflow-hidden">{orders?.length ? orders.map((order) => <Link key={order.id} href={`/account/orders/${order.id}`} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate text-sm font-bold">{order.stores?.name || "Store"}</p><p className="mt-1 text-xs capitalize text-muted">#{order.order_number} · {order.status}</p></div><div className="text-right"><p className="text-sm font-extrabold">{formatNaira(order.total)}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-kola">{order.payment_status}</p></div></Link>) : <p className="p-6 text-center text-sm text-muted">Your orders will show here after checkout.</p>}</div>
      </section>
    </div>
  );
}
