"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, Package, ShoppingBag, UserRound, WalletCards } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/cart", label: "Cart", icon: ShoppingBag, primary: true },
  { href: "/account/wallet", label: "Wallet", icon: WalletCards },
  { href: "/account/profile", label: "Account", icon: UserRound },
];

export default function PublicBottomNav() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => { try { const cart = JSON.parse(localStorage.getItem("sella-cart") || "[]"); setCount(cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)); } catch {} };
    update(); window.addEventListener("sella-cart-updated", update); window.addEventListener("storage", update);
    return () => { window.removeEventListener("sella-cart-updated", update); window.removeEventListener("storage", update); };
  }, []);
  return <nav className="fixed inset-x-3 bottom-3 z-40 mx-auto grid max-w-[520px] grid-cols-5 rounded-[22px] border border-line bg-white/95 p-1.5 backdrop-blur" style={{ boxShadow: "var(--shadow-float)" }}>{items.map(({ href, label, icon: Icon, primary }) => <Link key={href} href={href} className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold ${primary ? "mx-1 bg-kola text-white" : "text-muted hover:bg-surface hover:text-kola"}`}><Icon size={19} strokeWidth={primary ? 2.3 : 1.8} /><span>{label}</span>{primary && count > 0 && <span className="absolute right-1.5 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-mango px-1 text-[9px] font-extrabold text-kola-dark">{count}</span>}</Link>)}</nav>;
}
