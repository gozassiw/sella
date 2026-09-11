"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, WalletCards, UserRound } from "lucide-react";
const items = [{ href: "/account", label: "Home", icon: Home }, { href: "/account/orders", label: "Orders", icon: ShoppingBag }, { href: "/cart", label: "Cart", icon: ShoppingBag }, { href: "/account/wallet", label: "Wallet", icon: WalletCards }, { href: "/account/profile", label: "Account", icon: UserRound }];
export default function BuyerBottomNav() { const pathname = usePathname(); return <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white">{items.map(({ href, label, icon: Icon }) => { const active = href === "/account" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={`flex flex-col items-center gap-1 px-1 py-3 text-[10px] font-bold transition sm:text-[11px] ${active ? "bg-kola-light text-kola" : "text-muted hover:bg-surface hover:text-ink"}`}><Icon size={18} strokeWidth={2} /><span>{label}</span></Link>; })}</nav>; }
