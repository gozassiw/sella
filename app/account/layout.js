import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BuyerSignOutButton from "@/components/BuyerSignOutButton";
import BuyerBottomNav from "@/components/BuyerBottomNav";
export default async function AccountLayout({ children }) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login?next=/account"); return <div className="min-h-screen bg-surface pb-20"><header className="border-b border-ink bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-5 lg:px-10"><Link href="/account" aria-label="Sella buyer home" className="flex items-center gap-3"><Image src="/brand/sella-mark.png" alt="" width={30} height={30} className="h-7 w-7 rounded-md" /><span className="text-xl font-black tracking-[-.08em]">Sella</span></Link><div className="flex items-center gap-5 text-sm"><Link href="/cart" className="font-bold text-kola">Cart</Link><BuyerSignOutButton /></div></div></header><main className="mx-auto max-w-7xl px-5 py-10 lg:px-10 lg:py-14">{children}</main><BuyerBottomNav /></div>; }
