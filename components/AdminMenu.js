"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Banknote, BarChart3, CheckSquare, Flag, Landmark, Menu, Settings2, ShieldCheck, Store, Users, WalletCards, X } from "lucide-react";

const items = [
  ["overview", "Overview", BarChart3],
  ["approvals", "Seller approvals", CheckSquare],
  ["stores", "Stores & trust", Store],
  ["verification", "Verification", ShieldCheck],
  ["orders", "Orders & revenue", Banknote],
  ["withdrawals", "Withdrawals", WalletCards],
  ["reports", "Reports & safety", Flag],
  ["subscriptions", "Seller plans", Users],
  ["settings", "Platform settings", Settings2],
  ["payments", "TransactPay", Landmark],
  ["activity", "Webhook & audit activity", Activity],
];

export default function AdminMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-kola md:hidden" aria-label="Open Admin menu">
        <Menu size={20} />
      </button>
      {open && <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
        <button type="button" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/20" aria-label="Close Admin menu" />
        <aside className="absolute right-0 top-0 h-full w-[min(88vw,360px)] overflow-y-auto bg-white p-5">
          <div className="flex items-center justify-between border-b border-line pb-5"><div><p className="eyebrow text-kola">Sella Admin</p><p className="mt-1 text-sm font-extrabold">Control room</p></div><button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-kola" aria-label="Close Admin menu"><X size={20} /></button></div>
          <nav className="mt-5 space-y-1">{items.map(([id, label, Icon]) => <Link key={id} href={`#${id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-ink hover:bg-kola-light hover:text-kola"><Icon size={18} className="text-kola" />{label}</Link>)}</nav>
          <div className="mt-6 border-t border-line pt-5 text-xs leading-5 text-muted">All company controls are private to Admin. Use this menu to jump directly to each area on mobile.</div>
        </aside>
      </div>}
    </>
  );
}
