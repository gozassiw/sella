import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Package, ShieldCheck, ShoppingBag, TrendingUp, WalletCards } from "lucide-react";
import { getMyStore } from "@/lib/store";
import { formatNaira, storeUrl } from "@/lib/utils";
import { SITE_URL } from "@/lib/config";
import ShareStore from "@/components/ShareStore";
import CopyStoreLink from "@/components/CopyStoreLink";

function StatusPill({ status }) {
  const tone = status === "delivered" ? "bg-green-50 text-success" : status === "cancelled" ? "bg-red-50 text-danger" : "bg-amber-50 text-warning";
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{status}</span>;
}

export default async function DashboardHome() {
  const { supabase, store } = await getMyStore();
  const [{ count: productCount }, { count: lowStockCount }, { count: openOrderCount }, { data: recentOrders }, { data: wallet }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id).lte("stock", 3),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", store.id).in("status", ["pending", "processing", "shipped"]),
    supabase.from("orders").select("id,order_code,total,status,payment_status,created_at,customers(name)").eq("store_id", store.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("wallets").select("available").eq("store_id", store.id).maybeSingle(),
  ]);
  const completedOrders = Number(store.completed_orders || 0);
  const trialDays = store.trial_starts_at ? Math.max(0, Math.ceil((new Date(store.trial_ends_at) - new Date()) / 86400000)) : null;

  return <div className="space-y-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold text-muted">Your business today</p><h1 className="display mt-1 text-2xl sm:text-3xl">Welcome back, {store.name}</h1></div><Link href="/dashboard/products/new" className="btn-primary">Add product <ArrowRight size={16} /></Link></header>

    {store.approval_status === "pending" && <div className="flex items-start gap-3 rounded-[20px] bg-amber-50 p-4 text-warning"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-warning" /><div><p className="text-sm font-extrabold">Your store is being reviewed</p><p className="mt-1 text-xs leading-5">Your 10-day trial starts after approval and includes up to 15 products.</p></div></div>}
    {store.approval_status === "rejected" && <div className="rounded-[20px] bg-red-50 p-4 text-danger"><p className="text-sm font-extrabold">Your store needs an update</p><p className="mt-1 text-xs leading-5">{store.rejection_reason || "Review your store details and submit them again."}</p></div>}

    <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <Link href="/dashboard/wallet" className="relative overflow-hidden rounded-[28px] bg-kola-dark p-6 text-white sm:p-7" style={{ boxShadow: "0 18px 45px rgba(9,84,58,.22)" }}>
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold text-white/60">AVAILABLE TO WITHDRAW</p><p className="display mt-3 text-4xl sm:text-[42px]">{formatNaira(wallet?.available)}</p><p className="mt-2 text-xs text-white/65">Paid orders are available directly.</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-mango"><WalletCards size={21} /></span></div>
        <div className="mt-9 flex items-center justify-between"><span className="text-sm font-bold text-mango">Open wallet</span><ArrowRight size={18} /></div>
      </Link>
      <div className="app-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow text-kola">Store access</p><h2 className="mt-2 text-base font-extrabold">Share your store ID</h2></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-kola-light text-kola"><ShieldCheck size={20} /></span></div><p className="mt-3 text-xs leading-5 text-muted">Buyers enter this ID in their Sella account to open your store, trust it, and shop.</p><p className="mt-4 rounded-xl bg-kola-light px-4 py-3 text-center text-xl font-extrabold tracking-[.2em] text-kola">{store.seller_code || "Generating…"}</p><CopyStoreLink url={storeUrl(SITE_URL, store.slug)} />{trialDays !== null && <p className="mt-4 text-[11px] font-bold text-kola">{trialDays} days left in your 10-day trial · up to 15 products · <Link href="/dashboard/billing" className="underline">View plans</Link></p>}</div>
    </section>

    <section className="grid grid-cols-3 gap-3">
      {[{ label: "To fulfil", value: openOrderCount || 0, icon: ShoppingBag, href: "/dashboard/orders", accent: true }, { label: "Products", value: productCount || 0, icon: Package, href: "/dashboard/products" }, { label: "Low stock", value: lowStockCount || 0, icon: TrendingUp, href: "/dashboard/products", danger: Number(lowStockCount) > 0 }].map(({ label, value, icon: Icon, href, accent, danger }) => <Link key={label} href={href} className="app-card min-w-0 p-4 sm:p-5"><span className={`grid h-9 w-9 place-items-center rounded-2xl ${accent ? "bg-mango text-kola-dark" : danger ? "bg-red-50 text-danger" : "bg-kola-light text-kola"}`}><Icon size={17} /></span><p className="mt-4 text-2xl font-extrabold">{value}</p><p className="mt-1 truncate text-[11px] font-bold text-muted">{label}</p></Link>)}
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
      <div><div className="flex items-center justify-between"><div><p className="eyebrow text-kola">Orders</p><h2 className="display mt-2 text-2xl">Recent activity</h2></div><Link href="/dashboard/orders" className="text-xs font-bold text-kola">See all</Link></div><div className="app-card mt-4 divide-y divide-line overflow-hidden">{recentOrders?.length ? recentOrders.map((order) => <Link key={order.id} href={`/dashboard/orders?order=${order.id}`} className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-kola-light text-kola"><Package size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">#{order.order_code} · {order.customers?.name || "Customer"}</p><p className="mt-1 text-xs text-muted">{order.payment_status}</p></div><div className="text-right"><p className="text-sm font-extrabold">{formatNaira(order.total)}</p><div className="mt-1"><StatusPill status={order.status} /></div></div><ChevronRight size={16} className="text-muted" /></Link>) : <div className="flex flex-col items-center px-5 py-10 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-kola-light text-kola"><ShoppingBag size={21} /></span><p className="mt-4 text-sm font-extrabold">No orders yet</p><p className="mt-2 max-w-xs text-xs leading-5 text-muted">Give buyers your store ID so they can open your store, trust it, and order.</p><span className="btn-soft mt-4">Store ID: {store.seller_code || "Generating…"}</span></div>}</div></div>

      <div><p className="eyebrow text-kola">Next steps</p><h2 className="display mt-2 text-2xl">Finish your setup</h2><div className="app-card mt-4 p-5">{[{ done: (productCount || 0) > 0, label: "Add your first product", href: "/dashboard/products/new" }, { done: !!store.logo_url, label: "Add your store logo", href: "/dashboard/settings" }, { done: !!store.whatsapp, label: "Add WhatsApp contact", href: "/dashboard/settings" }].map((item, index) => <Link key={item.label} href={item.href} className={`flex items-center gap-3 py-3 ${index ? "border-t border-line" : ""}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${item.done ? "bg-kola text-white" : "border-2 border-line text-transparent"}`}>{item.done && <Check size={14} />}</span><span className={`text-sm font-bold ${item.done ? "text-muted line-through" : "text-ink"}`}>{item.label}</span><ChevronRight size={16} className="ml-auto text-muted" /></Link>)}</div></div>
    </section>

    <ShareStore url={storeUrl(SITE_URL, store.slug)} storeName={store.name} sellerCode={store.seller_code} />
  </div>;
}
