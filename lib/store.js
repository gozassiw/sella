import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Loads the signed-in seller and their store. Sends them to login or onboarding if needed.
export async function getMyStore() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: store } = await supabase.from("stores").select("id,owner_id,name,slug,category,description,whatsapp,phone,address,logo_url,brand_color,is_published,plan,trial_ends_at,trial_starts_at,approval_status,rejection_reason,created_at,legal_name,nin,nin_status,cac_number,cac_file_url,verification_approved,trusted,completed_orders,delivery_note").eq("owner_id", user.id).maybeSingle();
  if (!store) redirect("/onboarding");
  return { supabase, user, store };
}
