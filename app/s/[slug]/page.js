import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, whatsappLink } from "@/lib/utils";
import { BRAND } from "@/lib/config";
import CartLink from "@/components/CartLink";
import FollowStoreButton from "@/components/FollowStoreButton";

async function loadStore(slug) {
  const supabase = createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id,name,slug,description,whatsapp,phone,address,logo_url,brand_color,is_published")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return { supabase, store };
}

export async function generateMetadata({ params }) {
  const { store } = await loadStore(params.slug);
  if (!store) return { title: "Store not found" };
  return { title: store.name, description: store.description || `Shop from ${store.name}` };
}

export default async function StorePage({ params }) {
  const { supabase, store } = await loadStore(params.slug);
  if (!store) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: follow } = user ? await supabase.from("buyer_store_follows").select("id").eq("user_id", user.id).eq("store_id", store.id).maybeSingle() : { data: null };

  const { data: products } = await supabase
    .from("products")
    .select("id,name,price,compare_at_price,stock,image_urls")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const color = store.brand_color || "#0E5E4A";
  const wa = whatsappLink(store.whatsapp, `Hello ${store.name}, I found your store online.`);

  return (
    <div className="min-h-screen bg-white">
      <header className="text-white" style={{ background: color }}>
        <div className="mx-auto max-w-6xl px-5 pb-10 pt-8">
          <div className="flex items-center gap-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="h-16 w-16 rounded-2xl bg-white object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold">
                {store.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold md:text-3xl">{store.name}</h1>
              {store.address && <p className="text-sm opacity-80">{store.address}</p>}
            </div>
          </div>
          {store.description && <p className="mt-5 max-w-2xl opacity-90">{store.description}</p>}
          {wa && (
            <a href={wa} target="_blank" className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold" style={{ color }}>
              Chat on WhatsApp
            </a>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <CartLink color={color} />
            <Link href="/login?next=%2Faccount" className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white">Buyer login</Link>
            <Link href="/signup?next=%2Faccount%2Fsetup" className="rounded-full bg-white px-4 py-2 text-sm font-semibold" style={{ color }}>Create buyer account</Link>
            <FollowStoreButton storeId={store.id} initialFollowing={Boolean(follow)} color={color} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        {!products?.length ? (
          <p className="py-16 text-center text-muted">New products are coming soon. Check back shortly.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <Link key={p.id} href={`/s/${store.slug}/p/${p.id}`} className="group">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface">
                  {p.image_urls?.[0] && (
                    <img src={p.image_urls[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                  )}
                  {p.stock <= 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold">Sold out</span>
                  )}
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium">{p.name}</p>
                <p className="mt-1 font-bold">
                  {formatNaira(p.price)}
                  {p.compare_at_price > p.price && (
                    <span className="ml-2 text-sm font-normal text-muted line-through">{formatNaira(p.compare_at_price)}</span>
                  )}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Store powered by <Link href="/" className="font-semibold text-kola">{BRAND}</Link>. Create yours free.
      </footer>
    </div>
  );
}
