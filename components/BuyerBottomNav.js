"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Package, UserRound, WalletCards } from "lucide-react";
import ChatBadge from "@/components/ChatBadge";

const items = [
  { href: "/account", label: "Home", icon: Home },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/messages", label: "Messages", icon: MessageCircle },
  { href: "/account/wallet", label: "Wallet", icon: WalletCards },
  { href: "/account/profile", label: "Account", icon: UserRound },
];

export default function BuyerBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 mx-auto grid max-w-[520px] grid-cols-5 rounded-[22px] border border-line bg-white/95 p-1.5 backdrop-blur" style={{ boxShadow: "var(--shadow-float)" }}>
      {items.map(({ href, label, icon: Icon, primary }) => {
        const active = href === "/account" ? pathname === href : pathname.startsWith(href);
        const link = <Link key={href} href={href} prefetch className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold transition ${active ? "bg-kola text-white" : "text-muted hover:bg-surface hover:text-ink"}`}><Icon size={19} strokeWidth={active ? 2.3 : 1.8} /><span>{label}</span></Link>;
        return href === "/account/messages" ? <ChatBadge key={href}>{link}</ChatBadge> : link;
      })}
    </nav>
  );
}
