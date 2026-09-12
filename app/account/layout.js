import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ShoppingBag } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import BuyerBottomNav from "@/components/BuyerBottomNav";
import SellaBrand from "@/components/SellaBrand";

export default async function AccountLayout({ children }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { data: profile } = await supabase.from("buyer_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!profile) redirect("/account/setup");
  return (
    <div className="min-h-screen bg-surface pb-28">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <SellaBrand href="/account" />
          <div className="flex items-center gap-1">
            <Link href="/account#discover" aria-label="Search stores" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-kola"><Search size={19} strokeWidth={1.8} /></Link>
            <Link href="/cart" aria-label="Open cart" className="relative grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-kola"><ShoppingBag size={19} strokeWidth={1.8} /></Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      <BuyerBottomNav />
    </div>
  );
}
