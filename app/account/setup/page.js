import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import BuyerProfileForm from "@/components/BuyerProfileForm";

export default async function BuyerSetupPage({ searchParams }) {
  const { supabase, user } = await getCurrentUser();
  const returnTo = typeof searchParams?.returnTo === "string" && searchParams.returnTo.startsWith("/s/") ? searchParams.returnTo : "/account";
  if (!user) redirect(`/login?next=${encodeURIComponent(`/account/setup?returnTo=${returnTo}`)}`);
  const { data: profile } = await supabase.from("buyer_profiles").select("id,full_name,call_number,whatsapp,delivery_address").eq("user_id", user.id).maybeSingle();
  if (profile?.full_name && profile?.call_number && profile?.whatsapp) redirect(returnTo);
  return <div className="mx-auto flex min-h-[70vh] max-w-lg items-center"><div className="panel w-full"><p className="text-sm font-semibold text-kola">Buyer setup</p><h1 className="mt-1 text-3xl font-bold">Tell us about you</h1><p className="mt-2 text-sm text-muted">Save your name, call number, WhatsApp number, and usual delivery address so checkout is quicker next time.</p><div className="mt-6"><BuyerProfileForm profile={profile} returnTo={returnTo} /></div></div></div>;
}
