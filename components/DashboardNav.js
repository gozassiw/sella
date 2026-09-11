"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Home, Package, ShoppingBag, WalletCards, Users, BarChart3, Receipt, BadgeCheck, Settings, ExternalLink, LogOut, MoreHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BRAND, SITE_URL } from "@/lib/config";
import { storeUrl } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/wallet", label: "Wallet", icon: WalletCards },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/offline-sales", label: "Offline sales", icon: Receipt },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/billing", label: "Plans & billing", icon: WalletCards },
  { href: "/dashboard/verification", label: "Verification", icon: BadgeCheck },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];
const mobilePrimary = items.slice(0, 3);
const mobileMore = items.slice(3);

export default function DashboardNav({ store }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
  const moreActive = mobileMore.some(({ href }) => isActive(href));

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white p-4 md:flex">
        <span className="px-2 text-lg font-bold text-kola">{BRAND}</span>
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-surface p-3">
          {store.logo_url ? <img src={store.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kola font-bold text-white">{store.name.charAt(0).toUpperCase()}</div>}
          <span className="truncate text-sm font-semibold">{store.name}</span>
        </div>
        <nav className="mt-6 space-y-1 overflow-y-auto">
          {items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive(href) ? "bg-kola-light text-kola" : "text-muted hover:bg-surface"}`}><Icon size={18} /> {label}</Link>)}
        </nav>
        <div className="mt-auto space-y-1">
          <a href={storeUrl(SITE_URL, store.slug)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface"><ExternalLink size={18} /> View my store</a>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface"><LogOut size={18} /> Log out</button>
        </div>
      </aside>

      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
        <span className="max-w-[55%] truncate font-semibold">{store.name}</span>
        <a href={storeUrl(SITE_URL, store.slug)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-kola">View store <ExternalLink size={14} /></a>
      </div>

      {moreOpen && <div className="fixed inset-x-3 bottom-[76px] z-30 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-white p-3 shadow-2xl md:hidden"><div className="mb-2 flex items-center justify-between px-2"><span className="font-semibold">More seller tools</span><button onClick={() => setMoreOpen(false)} aria-label="Close menu"><X size={20} /></button></div><div className="grid grid-cols-2 gap-2">{mobileMore.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMoreOpen(false)} className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium ${isActive(href) ? "bg-kola-light text-kola" : "bg-surface text-muted"}`}><Icon size={18} /> <span>{label}</span></Link>)}</div><button onClick={signOut} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-red-700 hover:bg-red-50"><LogOut size={18} /> Log out</button></div>}

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white md:hidden">
        {mobilePrimary.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-0 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive(href) ? "text-kola" : "text-muted"}`}><Icon size={20} /><span className="truncate">{label}</span></Link>)}
        <button onClick={() => setMoreOpen((open) => !open)} className={`flex min-w-0 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${moreOpen || moreActive ? "text-kola" : "text-muted"}`}><MoreHorizontal size={20} /><span>More</span></button>
      </nav>
    </>
  );
}
