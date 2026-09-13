import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getMyStore = cache(async function getMyStore() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: store } = await supabase.from("stores").select("id,owner_id,name,slug,seller_code,seller_code_active,order_access_suspended,category,description,whatsapp,phone,address,logo_url,brand_color,is_published,plan,trial_ends_at,trial_starts_at,approval_status,rejection_reason,onboarding_submitted_at,verification_notes,created_at,legal_name,nin,nin_status,cac_number,cac_file_url,verification_approved,trusted,completed_orders,delivery_note").eq("owner_id", user.id).maybeSingle();
  if (!store) redirect("/onboarding");
  const { data: held } = await supabase.rpc("is_account_held", { p_user_id: user.id });
  return { supabase, user, store, held: held === true };
});

export async function storeIsOperational(supabase, storeId) {
  const { data, error } = await supabase.rpc("store_can_operate", { p_store_id: storeId });
  return !error && data === true;
}

export function sellerVerificationMessage(store) {
  if (store?.approval_status === "rejected") return store.rejection_reason || "Sella Team asked for an update before this store can go live.";
  if (store?.approval_status !== "approved") return "Sella Team is reviewing this store. It will become visible and accept orders after verification.";
  return "";
}
