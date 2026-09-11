"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, WalletCards, UserRound } from "lucide-react";
const items = [{ href: "/account", label: "Home", icon: Home }, { href: "/account/orders", label: "Orders", icon: ShoppingBag }, { href: "/account/wallet", label: "Wallet", icon: WalletCards }, { href: "/account/profile", label: "Profile", icon: UserRound }];
export default function BuyerBottomNav() { const pathname = usePathname(); return <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-2xl border border-white/70 bg-white/80 p-1.5 shadow-2xl backdrop-blur-xl md:inset-x-auto md:left-1/2 md:w-[480px] md:-translate-x-1/2">{items.map(({ href, label, icon: Icon }) => { const active = href === "/account" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition ${active ? "bg-kola text-white shadow-sm" : "text-muted hover:bg-white"}`}><Icon size={19} /><span>{label}</span></Link>; })}</nav>; }
