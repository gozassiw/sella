"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, WalletCards, UserRound } from "lucide-react";
const items = [{ href: "/account", label: "Home", icon: Home }, { href: "/account/orders", label: "Orders", icon: ShoppingBag }, { href: "/cart", label: "Cart", icon: ShoppingBag }, { href: "/account/wallet", label: "Wallet", icon: WalletCards }, { href: "/account/profile", label: "Account", icon: UserRound }];
export default function BuyerBottomNav() { const pathname = usePathname(); return <nav className="fixed inset-x-2 bottom-2 z-30 mx-auto grid max-w-lg grid-cols-5 rounded-2xl border border-white/80 bg-white/90 p-1.5 shadow-2xl backdrop-blur-xl">{items.map(({ href, label, icon: Icon }) => { const active = href === "/account" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition sm:text-[11px] ${active ? "bg-kola text-white shadow-sm" : "text-muted hover:bg-surface"}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></Link>; })}</nav>; }
