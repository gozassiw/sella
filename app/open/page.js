import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OpenAppPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  const { data: admin } = await supabase.rpc("is_platform_admin");
  if (admin === true) redirect("/admin");
  const { data: store } = await supabase.from("stores").select("id,approval_status").eq("owner_id", user.id).maybeSingle();
  if (store) redirect(store.approval_status === "approved" ? "/dashboard" : "/onboarding");
  redirect("/account");
}
