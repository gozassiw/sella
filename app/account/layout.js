import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BuyerSignOutButton from "@/components/BuyerSignOutButton";
import BuyerBottomNav from "@/components/BuyerBottomNav";
export default async function AccountLayout({ children }) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login?next=/account"); return <div className="min-h-screen bg-surface pb-28"><header className="border-b border-line/80 bg-white/75 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 lg:px-8"><Link href="/account" aria-label="Sella buyer home" className="flex items-center gap-3"><Image src="/brand/sella-mark.png" alt="" width={36} height={36} className="h-8 w-8" /><span className="font-serif text-xl font-bold">Sella</span></Link><div className="flex items-center gap-5 text-sm"><Link href="/cart" className="font-semibold text-kola">Cart</Link><BuyerSignOutButton /></div></div></header><main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">{children}</main><BuyerBottomNav /></div>; }
