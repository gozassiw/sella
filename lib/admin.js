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
  const authorized = Boolean(user && configuredAdminEmails().includes(String(user.email || "").toLowerCase()));
  return { user, authorized, supabase };
}

export function isAdminEmail(email) {
  return configuredAdminEmails().includes(String(email || "").toLowerCase());
}
