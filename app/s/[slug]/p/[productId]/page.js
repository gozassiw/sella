import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MessageCircle, PackageCheck, ShieldCheck } from "lucide-react";
import { getPublicStore, getPublicProduct } from "@/lib/storefront";
import { formatNaira, whatsappLink, storeUrl } from "@/lib/utils";
import { SITE_URL } from "@/lib/config";
import AddToCartButton from "@/components/AddToCartButton";
import ReportForm from "@/components/ReportForm";
import PublicBottomNav from "@/components/PublicBottomNav";
import SellaBrand from "@/components/SellaBrand";

export const revalidate = 60;
export const dynamic = "force-static";

export default async function ProductPage({ params }) {
  const store = await getPublicStore(params.slug);
  if (!store) return null;
  const product = await getPublicProduct(store.id, params.productId);
  if (!product) return null;
  const link = `${storeUrl(SITE_URL, store.slug)}/p/${product.id}`;
  const wa = whatsappLink(store.whatsapp, `Hello ${store.name}, I want to order: ${product.name} (${formatNaira(product.price)}). ${link}`);
  const [main, ...rest] = product.image_urls || [];
  const soldOut = product.stock <= 0;

  return <div className="min-h-screen bg-surface pb-28">
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1080px] items-center justify-between px-4 py-3.5 sm:px-6"><Link href={`/s/${store.slug}`} className="grid h-10 w-10 place-items-center rounded-full bg-surface"><ArrowLeft size={19} /></Link><SellaBrand compact /><Link href={`/s/${store.slug}`} className="rounded-xl bg-kola-light px-3 py-2 text-xs font-extrabold text-kola">{store.name}</Link></div></header>
    <main className="mx-auto grid max-w-[1080px] gap-7 px-4 py-5 sm:px-6 md:grid-cols-[1.08fr_.92fr] md:gap-10 md:py-10">
      <div className="space-y-3"><div className="relative aspect-[4/5] overflow-hidden rounded-[26px] bg-white md:aspect-square">{main ? <Image src={main} alt={product.name} fill priority sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" /> : <div className="grid h-full place-items-center text-sm font-semibold text-muted">Product photo</div>}{soldOut && <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-danger">SOLD OUT</span>}</div>{rest.length > 0 && <div className="flex gap-3 overflow-x-auto">{rest.map((url) => <div key={url} className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-2xl bg-white"><Image src={url} alt="" fill sizes="80px" className="object-cover" /></div>)}</div>}</div>
      <section className="md:pt-4"><Link href={`/s/${store.slug}`} className="inline-flex items-center gap-2 text-xs font-extrabold text-kola"><span className="grid h-7 w-7 place-items-center rounded-xl bg-kola text-[10px] text-white">{store.name.charAt(0)}</span>{store.name}</Link><h1 className="display mt-5 text-3xl leading-tight sm:text-4xl">{product.name}</h1><div className="mt-4 flex items-end gap-3"><p className="text-2xl font-extrabold text-kola">{formatNaira(product.price)}</p>{product.compare_at_price > product.price && <p className="pb-0.5 text-sm text-muted line-through">{formatNaira(product.compare_at_price)}</p>}</div><p className={`mt-3 text-xs font-bold ${soldOut ? "text-danger" : product.stock <= 3 ? "text-warning" : "text-success"}`}>{soldOut ? "Sold out" : product.stock <= 3 ? `Only ${product.stock} left` : "In stock and ready to order"}</p>{product.description && <p className="mt-6 whitespace-pre-line text-sm leading-7 text-muted">{product.description}</p>}<AddToCartButton product={product} store={store} />{!soldOut && wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-secondary mt-3 w-full"><MessageCircle size={17} />Ask on WhatsApp</a>}<div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-[20px] bg-white p-4"><PackageCheck size={19} className="text-kola" /><p className="mt-3 text-xs font-extrabold">Direct from seller</p><p className="mt-1 text-[11px] leading-5 text-muted">Fulfilment is arranged with {store.name}.</p></div><div className="rounded-[20px] bg-white p-4"><ShieldCheck size={19} className="text-kola" /><p className="mt-3 text-xs font-extrabold">Protected delivery</p><p className="mt-1 text-[11px] leading-5 text-muted">Confirm receipt with your delivery code.</p></div></div><div className="mt-6 border-t border-line pt-4"><ReportForm storeId={store.id} productId={product.id} type="product" triggerLabel="Report this product" /></div></section>
    </main>
    <PublicBottomNav />
  </div>;
}
