import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, whatsappLink, storeUrl } from "@/lib/utils";
import { SITE_URL } from "@/lib/config";
import AddToCartButton from "@/components/AddToCartButton";
import CartLink from "@/components/CartLink";

export default async function ProductPage({ params }) {
  const supabase = createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id,name,slug,whatsapp,phone,brand_color")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.productId)
    .eq("store_id", store.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!product) notFound();

  const color = store.brand_color || "#0E5E4A";
  const link = `${storeUrl(SITE_URL, store.slug)}/p/${product.id}`;
  const wa = whatsappLink(store.whatsapp, `Hello ${store.name}, I want to order: ${product.name} (${formatNaira(product.price)}). ${link}`);
  const [main, ...rest] = product.image_urls || [];
  const soldOut = product.stock <= 0;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-4">
          <Link href={`/s/${store.slug}`} className="flex items-center gap-1 text-sm font-semibold" style={{ color }}>
            <ChevronLeft size={18} /> {store.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 md:grid-cols-2 md:gap-12">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-2xl bg-surface">
            {main && <img src={main} alt={product.name} className="h-full w-full object-cover" />}
          </div>
          {rest.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {rest.map((url) => (
                <img key={url} src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{product.name}</h1>
          <p className="mt-3 text-2xl font-bold">
            {formatNaira(product.price)}
            {product.compare_at_price > product.price && (
              <span className="ml-3 text-lg font-normal text-muted line-through">{formatNaira(product.compare_at_price)}</span>
            )}
          </p>
          <p className={`mt-2 text-sm ${soldOut ? "font-semibold text-red-700" : "text-muted"}`}>
            {soldOut ? "Sold out" : product.stock <= 3 ? `Only ${product.stock} left` : "In stock"}
          </p>

          <div className="mt-5"><CartLink color={color} /></div>
          <AddToCartButton product={product} store={store} />

          {!soldOut && wa && (
            <a href={wa} target="_blank" className="mt-6 flex w-full items-center justify-center rounded-xl py-3.5 font-semibold text-white" style={{ background: color }}>
              Order on WhatsApp
            </a>
          )}
          {!soldOut && !wa && store.phone && (
            <a href={`tel:${store.phone}`} className="mt-6 flex w-full items-center justify-center rounded-xl py-3.5 font-semibold text-white" style={{ background: color }}>
              Call to order
            </a>
          )}

          {product.description && (
            <div className="mt-8 whitespace-pre-line leading-relaxed text-ink/80">{product.description}</div>
          )}
        </div>
      </main>
    </div>
  );
}
