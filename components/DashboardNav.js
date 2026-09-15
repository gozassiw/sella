"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, BadgeCheck, Bell, Home, LogOut, Menu, MessageCircle, Package, Receipt, Settings, ShoppingBag, Users, WalletCards, X } from "lucide-react";
import SellaBrand from "@/components/SellaBrand";
import NotificationBell from "@/components/NotificationBell";
import ChatBadge from "@/components/ChatBadge";

const primary = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  { href: "/dashboard/wallet", label: "Wallet", icon: WalletCards },
];
const tools = [
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/offline-sales", label: "Offline sales", icon: Receipt },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/billing", label: "Plans & billing", icon: WalletCards },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/verification", label: "Seller verification", icon: Settings },
  { href: "/dashboard/verification-badge", label: "Blue checkmark", icon: BadgeCheck },
  { href: "/dashboard/settings", label: "Store settings", icon: Settings },
];

export default function DashboardNav({ store }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = (href) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  async function signOut() { const { createClient } = await import("@/lib/supabase/client"); await createClient().auth.signOut(); router.push("/login"); router.refresh(); }
  const toolLink = (item) => { const Icon = item.icon; const link = <Link key={item.href} href={item.href} prefetch onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold ${active(item.href) ? "bg-kola-light text-kola" : "bg-surface text-ink hover:bg-kola-light"}`}><Icon size={17} />{item.label}</Link>; return item.href === "/dashboard/notifications" ? <NotificationBell key={item.href}>{link}</NotificationBell> : link; };
  const primaryLink = (item, mobile = false) => { const Icon = item.icon; const selected = active(item.href); const link = <Link key={`${mobile ? "mobile" : "desktop"}-${item.href}`} href={item.href} prefetch className={`${mobile ? "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold" : "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold"} ${selected ? (mobile ? "bg-kola text-white" : "bg-mango text-kola-dark") : (mobile ? "text-muted" : "text-white/70 hover:bg-white/10 hover:text-white")}`}><Icon size={mobile ? 19 : 18} strokeWidth={selected ? 2.3 : 1.8} /><span>{item.label}</span></Link>; return item.href === "/dashboard/messages" ? <ChatBadge key={`${mobile ? "mobile" : "desktop"}-${item.href}`}>{link}</ChatBadge> : link; };

  return <>
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col bg-kola-dark px-4 py-5 text-white md:flex"><div className="px-2"><SellaBrand href="/dashboard" inverted /></div><div className="mt-7 rounded-[22px] bg-white/10 p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-sm font-extrabold text-kola">{store.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-extrabold">{store.name}</p><p className="mt-1 text-[11px] text-white/55">{store.approval_status === "approved" ? "Store is live" : "Awaiting approval"}</p></div></div><p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-white/50">Buyer store ID</p><p className="mt-1 text-lg font-extrabold tracking-[.18em] text-mango">{store.seller_code || "Generating…"}</p></div><nav className="mt-6 space-y-1">{primary.map((item) => primaryLink(item))}</nav><button onClick={signOut} className="mt-auto flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white"><LogOut size={18} />Log out</button></aside>
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white/95 px-4 py-3.5 backdrop-blur md:fixed md:right-0 md:left-[264px] md:px-8"><SellaBrand href="/dashboard" /><div className="flex items-center gap-2"><NotificationBell><Link href="/dashboard/notifications" aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-kola"><Bell size={17} /></Link></NotificationBell><span className="hidden rounded-xl bg-kola-light px-3 py-2 text-xs font-extrabold tracking-wider text-kola sm:inline-flex">{store.seller_code || "…"}</span><button type="button" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? "Close seller tools" : "Open seller tools"} className={`grid h-10 w-10 place-items-center rounded-xl ${menuOpen ? "bg-kola text-white" : "bg-surface text-kola"}`}><Menu size={19} /></button></div></header>
    {menuOpen && <><button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default bg-black/10" onClick={() => setMenuOpen(false)} /><div className="fixed right-3 top-[68px] z-50 w-[min(360px,calc(100vw-24px))] rounded-[26px] border border-line bg-white p-4" style={{ boxShadow: "var(--shadow-float)" }}><div className="flex items-center justify-between px-1 pb-3"><div><p className="eyebrow text-kola">Seller tools</p><p className="mt-1 text-base font-extrabold">Manage your store</p></div><button type="button" onClick={() => setMenuOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-surface" aria-label="Close seller tools"><X size={17} /></button></div><div className="grid grid-cols-2 gap-2">{tools.map(toolLink)}</div><button onClick={signOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-danger"><LogOut size={17} />Log out</button></div></>}
    <nav className="fixed inset-x-3 bottom-3 z-40 mx-auto grid max-w-[520px] grid-cols-5 rounded-[22px] border border-line bg-white/95 p-1.5 backdrop-blur md:hidden" style={{ boxShadow: "var(--shadow-float)" }}>{primary.map((item) => primaryLink(item, true))}</nav>
  </>;
}
