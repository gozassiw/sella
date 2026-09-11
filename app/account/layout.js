import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BuyerSignOutButton from "@/components/BuyerSignOutButton";
import BuyerBottomNav from "@/components/BuyerBottomNav";
export default async function AccountLayout({ children }) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login?next=/account"); return <div className="min-h-screen bg-[#F4F7F5] pb-28"><header className="border-b border-white/80 bg-white/75 backdrop-blur-xl"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4"><Link href="/account" className="font-bold text-kola">Sella <span className="font-normal text-muted">Buyer</span></Link><div className="flex items-center gap-4 text-sm"><Link href="/cart" className="font-semibold text-kola">Cart</Link><BuyerSignOutButton /></div></div></header><main className="mx-auto max-w-5xl px-5 py-8">{children}</main><BuyerBottomNav /></div>; }
