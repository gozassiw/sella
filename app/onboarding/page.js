import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SellerOnboardingForm from "@/components/SellerOnboardingForm";
import { SITE_URL } from "@/lib/config";

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");
  const { data: store } = await supabase.from("stores").select("id,owner_id,name,slug,category,description,whatsapp,phone,address,legal_name,nin,cac_number,cac_file_url,approval_status").eq("owner_id", user.id).maybeSingle();
  if (store?.approval_status === "approved") redirect("/dashboard");
  const { data: bank } = store ? await supabase.from("store_bank_accounts").select("bank_name,account_number,account_name").eq("store_id", store.id).maybeSingle() : { data: null };
  return <SellerOnboardingForm userId={user.id} siteUrl={SITE_URL} initialStore={store} initialBank={bank} />;
}
