import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";
import StoreAccessForm from "@/components/StoreAccessForm";

function ProductCard({ product, store }) {
  return (
    <Link href={`/s/${store.slug}/p/${product.id}`} className="group block min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-[22px] bg-white">
        {product.image_urls?.[0] ? <Image src={product.image_urls[0]} alt={product.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-[1.035]" /> : <div className="grid h-full place-items-center text-xs font-semibold text-muted">Product photo</div>}
      </div>
      <p className="mt-3 truncate text-sm font-bold">{product.name}</p>
      <div className="mt-1 flex items-center justify-between gap-2"><p className="truncate text-xs text-muted">{store.name}</p><p className="shrink-0 text-sm font-extrabold text-kola">{formatNaira(product.price)}</p></div>
    </Link>
  );
}

export default async function AccountPage() {
  const { supabase, user } = await getCurrentUser();
  const [{ data: profile }, { data: orders }, { data: follows }] = await Promise.all([
    supabase.from("buyer_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("orders").select("id,order_code,total,status,payment_status,created_at,stores(name,slug)").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("buyer_store_follows").select("store_id,stores(id,name,slug,category,logo_url,brand_color)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!profile) redirect("/account/setup");
  const trustedStores = (follows || []).map((item) => item.stores).filter(Boolean);
  const storeMap = new Map(trustedStores.map((store) => [store.id, store]));
  const trustedIds = trustedStores.map((store) => store.id);
  const { data: products } = trustedIds.length
    ? await supabase.from("products").select("id,store_id,name,price,image_urls,created_at").in("store_id", trustedIds).eq("is_active", true).order("created_at", { ascending: false }).limit(40)
    : { data: [] };
  const feed = (products || []).map((product) => ({ product, store: storeMap.get(product.store_id) })).filter((item) => item.store);
  const firstName = profile?.full_name?.split(" ")?.[0] || user.email?.split("@")[0] || "there";

  return (
    <div className="space-y-10">
      <section className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-muted">Welcome back</p><h1 className="display mt-1 text-2xl sm:text-3xl">Hi, {firstName}</h1></div></section>
      <StoreAccessForm />
      <section>
        <div className="flex items-end justify-between gap-4"><div><p className="eyebrow text-kola">Trusted stores</p><h2 className="display mt-2 text-2xl sm:text-3xl">Latest from your stores</h2></div></div>
        {feed.length ? <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4">{feed.map(({ product, store }) => <ProductCard key={product.id} product={product} store={store} />)}</div> : <div className="app-card mt-5 flex flex-col items-center px-6 py-12 text-center"><span className="grid h-14 w-14 place-items-center rounded-[20px] bg-kola-light text-kola"><Store size={23} /></span><h3 className="mt-5 text-base font-extrabold">Your trusted-store feed is empty</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted">Enter a seller’s store ID above, open their store, and tap “Trust this store” before shopping.</p><a href="#store-access" className="btn-soft mt-5">Open a store</a></div>}
      </section>
      <section>
        <div className="flex items-center justify-between"><h2 className="text-base font-extrabold">Trusted stores</h2><span className="chip">{trustedStores.length}</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{trustedStores.length ? trustedStores.map((store) => <Link key={store.id} href={`/s/${store.slug}`} className="app-card flex items-center gap-4 p-4"><div className="shrink-0">{store.logo_url ? <Image src={store.logo_url} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-[18px] object-cover" /> : <span className="grid h-[52px] w-[52px] place-items-center rounded-[18px] bg-kola text-sm font-extrabold text-white">{store.name.charAt(0)}</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{store.name}</p><p className="mt-1 truncate text-xs text-muted">{store.category || "Trusted Sella store"}</p></div><ArrowRight size={17} className="text-muted" /></Link>) : <p className="app-card p-6 text-center text-sm text-muted sm:col-span-2">Stores you trust will appear here.</p>}</div>
      </section>
      <section>
        <div className="flex items-center justify-between"><h2 className="text-base font-extrabold">Recent orders</h2><Link href="/account/orders" className="text-xs font-bold text-kola">See all</Link></div>
        <div className="app-card mt-4 divide-y divide-line overflow-hidden">{orders?.length ? orders.map((order) => <Link key={order.id} href={`/account/orders/${order.id}`} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate text-sm font-bold">{order.stores?.name || "Store"}</p><p className="mt-1 text-xs capitalize text-muted">#{order.order_code} · {order.status}</p></div><div className="text-right"><p className="text-sm font-extrabold">{formatNaira(order.total)}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-kola">{order.payment_status}</p></div></Link>) : <p className="p-6 text-center text-sm text-muted">Your orders will show here after checkout.</p>}</div>
      </section>
    </div>
  );
}
