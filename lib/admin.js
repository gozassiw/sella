import { createClient } from "@/lib/supabase/server";

function configuredAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, authorized: false, supabase };
  const { data: rpcAuthorized, error } = await supabase.rpc("is_platform_admin");
  const authorized = !error && rpcAuthorized === true;
  return { user, authorized, supabase };
}

export function isAdminEmail(email) {
  return configuredAdminEmails().includes(String(email || "").toLowerCase());
}
