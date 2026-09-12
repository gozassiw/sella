"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, Bell, ExternalLink, Home, LogOut, MoreHorizontal, Package, Receipt, Settings, ShoppingBag, Users, WalletCards, X } from "lucide-react";
import { SITE_URL } from "@/lib/config";
import { storeUrl } from "@/lib/utils";
import SellaBrand from "@/components/SellaBrand";

const primary = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/wallet", label: "Wallet", icon: WalletCards },
];
const tools = [
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/offline-sales", label: "Offline sales", icon: Receipt },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/verification", label: "Verification", icon: Settings },
  { href: "/dashboard/billing", label: "Plans & billing", icon: WalletCards },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/settings", label: "Store settings", icon: Settings },
];

export default function DashboardNav({ store }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const active = (href) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  async function signOut() { const { createClient } = await import("@/lib/supabase/client"); await createClient().auth.signOut(); router.push("/login"); router.refresh(); }
  const desktopItem = (item) => { const Icon = item.icon; const selected = active(item.href); return <Link key={item.href} href={item.href} prefetch className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition ${selected ? "bg-mango text-kola-dark" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><Icon size={18} strokeWidth={selected ? 2.3 : 1.8} />{item.label}</Link>; };

  return <>
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col bg-kola-dark px-4 py-5 text-white md:flex">
      <div className="px-2"><SellaBrand href="/dashboard" inverted /></div>
      <div className="mt-7 rounded-[22px] bg-white/10 p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-sm font-extrabold text-kola">{store.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-extrabold">{store.name}</p><p className="mt-1 text-[11px] text-white/55">{store.approval_status === "approved" ? "Store is live" : "Awaiting approval"}</p></div></div><a href={storeUrl(SITE_URL, store.slug)} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-xs font-bold text-mango">View storefront <ExternalLink size={13} /></a></div>
      <nav className="mt-6 space-y-1">{primary.map(desktopItem)}</nav>
      <details className="mt-2 group"><summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white"><MoreHorizontal size={18} />More tools</summary><nav className="mt-1 max-h-[280px] space-y-1 overflow-y-auto border-l border-white/15 pl-2">{tools.map(desktopItem)}</nav></details>
      <button onClick={signOut} className="mt-auto flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white"><LogOut size={18} />Log out</button>
    </aside>

    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/95 px-4 py-3.5 backdrop-blur md:hidden"><SellaBrand href="/dashboard" /><div className="flex items-center gap-2"><Link href="/dashboard/notifications" aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-kola"><Bell size={17} /></Link><a href={storeUrl(SITE_URL, store.slug)} target="_blank" rel="noreferrer" className="rounded-xl bg-kola-light px-3 py-2 text-xs font-extrabold text-kola">View store</a></div></header>

    {moreOpen && <div className="fixed inset-x-3 bottom-[86px] z-50 mx-auto max-h-[70vh] max-w-[520px] overflow-y-auto rounded-[26px] border border-line bg-white p-4" style={{ boxShadow: "var(--shadow-float)" }}><div className="flex items-center justify-between px-1 pb-3"><div><p className="eyebrow text-kola">Workspace</p><p className="mt-1 text-base font-extrabold">More tools</p></div><button onClick={() => setMoreOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label="Close menu"><X size={19} /></button></div><div className="grid grid-cols-2 gap-2">{tools.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={`flex items-center gap-3 rounded-2xl p-3.5 text-xs font-bold ${active(item.href) ? "bg-kola-light text-kola" : "bg-surface text-ink"}`}><Icon size={17} />{item.label}</Link>; })}</div><button onClick={signOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-danger"><LogOut size={17} />Log out</button></div>}

    <nav className="fixed inset-x-3 bottom-3 z-40 mx-auto grid max-w-[520px] grid-cols-5 rounded-[22px] border border-line bg-white/95 p-1.5 backdrop-blur md:hidden" style={{ boxShadow: "var(--shadow-float)" }}>
      {primary.map((item) => { const Icon = item.icon; const selected = active(item.href); return <Link key={item.href} href={item.href} prefetch className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold ${selected ? "bg-kola text-white" : "text-muted"}`}><Icon size={19} strokeWidth={selected ? 2.3 : 1.8} /><span>{item.label}</span></Link>; })}
      <button onClick={() => setMoreOpen(!moreOpen)} className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold ${moreOpen ? "bg-kola-light text-kola" : "text-muted"}`}><MoreHorizontal size={19} /><span>More</span></button>
    </nav>
  </>;
}
