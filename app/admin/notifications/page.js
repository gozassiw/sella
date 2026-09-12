import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationSettings from "@/components/NotificationSettings";

export default async function AdminNotificationsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: authorized } = user ? await supabase.rpc("is_platform_admin") : { data: false };
  if (!user) redirect("/login?next=/admin/notifications");
  if (authorized !== true) redirect("/admin");
  return <NotificationSettings />;
}
