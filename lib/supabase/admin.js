import { createClient } from "@supabase/supabase-js";

function keyRole(key) {
  if (!key || key.startsWith("sb_secret_")) return key ? "secret" : "missing";
  const parts = key.split(".");
  if (parts.length !== 3) return "unknown";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload.role || "unknown";
  } catch {
    return "unknown";
  }
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured for Production");
  const role = keyRole(key);
  if (role === "anon" || role === "authenticated" || role === "publishable") throw new Error("SUPABASE_SERVICE_ROLE_KEY contains an anon/publishable key. Replace it with the Supabase service_role secret for this project.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
