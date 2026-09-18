"use client";

import { useState } from "react";
import { Activity, BadgeCheck, Banknote, BarChart3, Bell, CalendarDays, CheckSquare, ClipboardList, Flag, Landmark, Menu, Settings2, ShieldCheck, Store, Users, WalletCards, X, ArrowUpRight } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const items = [
  ["overview", "Overview", BarChart3],
  ["approvals", "Seller approvals", CheckSquare],
  ["stores", "Stores & trust", Store],
  ["accounts", "Buyer & seller accounts", Users],
  ["verification", "Verification", ShieldCheck],
  ["orders", "Orders & revenue", Banknote],
  ["withdrawals", "Withdrawals", WalletCards],
  ["reports", "Reports & safety", Flag],
  ["demos", "Demo requests", CalendarDays],
  ["waitlist", "Launch waitlist", ClipboardList],
  ["subscriptions", "Seller plans", Users],
  ["badge_reviews", "Blue-check reviews", BadgeCheck],
  ["settings", "Platform settings", Settings2],
  ["payments", "TransactPay", Landmark],
  ["activity", "Webhook & audit activity", Activity],
  ["notifications", "Notifications", Bell],
];

export default function AdminMenu() {
  const [open, setOpen] = useState(false);
  function jumpTo(id) {
    setOpen(false);
    window.location.assign(id === "overview" ? "/admin" : `/admin?section=${encodeURIComponent(id)}`);
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-kola md:hidden" aria-label="Open Admin menu">
        <Menu size={20} />
      </button>
      {open && <div className="fixed inset-0 z-[70] h-[100dvh] overflow-y-auto bg-[#f4f7f4] p-5 md:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="mx-auto w-full max-w-xl">
            <div className="flex items-center justify-between border-b border-line pb-5"><div><p className="eyebrow text-kola">Sella Admin</p><p className="mt-1 text-sm font-extrabold">Control room menu</p></div><button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-kola" aria-label="Close Admin menu"><X size={20} /></button></div>
             <nav className="mt-5 grid gap-2">{items.map(([id, label, Icon]) => { const item = <button key={id} type="button" onClick={() => jumpTo(id)} className="flex min-h-14 w-full items-center gap-4 rounded-2xl border border-line bg-white px-4 py-3 text-left text-base font-bold text-ink shadow-sm hover:border-kola hover:bg-kola-light hover:text-kola"><Icon size={20} className="text-kola" /><span className="flex-1">{label}</span><ArrowUpRight size={15} className="text-muted" /></button>; return id === "notifications" ? <NotificationBell key={id}>{item}</NotificationBell> : item; })}</nav>
            <div className="mt-6 border-t border-line pb-8 pt-5 text-xs leading-5 text-muted">All company controls are private to Admin. Choose an area to jump to it, or close this menu to continue on the overview.</div>
          </div>
      </div>}
    </>
  );
}
