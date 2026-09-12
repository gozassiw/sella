import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import CheckoutForm from "@/components/CheckoutForm";
import BuyerBottomNav from "@/components/BuyerBottomNav";

export default async function CheckoutPage() {
  const { supabase, user } = await getCurrentUser();
  const { data: profile } = user
    ? await supabase.from("buyer_profiles").select("full_name,call_number,whatsapp,delivery_address").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const homeHref = user ? "/account" : "/";
  return <div className="min-h-screen bg-surface pb-28"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5"><Link href={homeHref} className="font-bold text-kola">Sella</Link><Link href="/cart" className="text-sm font-semibold text-kola">Back to cart</Link></div></header><main className="px-5 py-10"><CheckoutForm initialProfile={profile} /></main>{user && <BuyerBottomNav />}</div>;
}
