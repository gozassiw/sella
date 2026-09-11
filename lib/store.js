import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Loads the signed-in seller and their store. Sends them to login or onboarding if needed.
export async function getMyStore() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: store } = await supabase.from("stores").select("*").eq("owner_id", user.id).maybeSingle();
  if (!store) redirect("/onboarding");
  return { supabase, user, store };
}
