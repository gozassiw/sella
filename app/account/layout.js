import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BuyerSignOutButton from "@/components/BuyerSignOutButton";
import BuyerBottomNav from "@/components/BuyerBottomNav";
export default async function AccountLayout({ children }) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login?next=/account"); return <div className="min-h-screen bg-surface pb-28"><header className="border-b border-white/80 bg-white/80 backdrop-blur-xl"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4"><Link href="/account" aria-label="Sella buyer home"><Image src="/brand/sella-logo.png" alt="Sella" width={136} height={57} className="h-auto w-28" /></Link><div className="flex items-center gap-4 text-sm"><Link href="/cart" className="font-semibold text-kola">Cart</Link><BuyerSignOutButton /></div></div></header><main className="mx-auto max-w-5xl px-5 py-8">{children}</main><BuyerBottomNav /></div>; }
