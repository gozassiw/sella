import { createClient } from "@/lib/supabase/server";

let cachedSettings = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

export async function getPublicLaunchSettings() {
  const now = Date.now();
  if (cachedSettings && now - cachedAt < CACHE_TTL_MS) return cachedSettings;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_public_launch_settings");
    if (error) throw error;
    const settings = Array.isArray(data) ? data[0] || {} : data || {};
    cachedSettings = {
      enabled: settings.enabled === true,
      launch_at: typeof settings.launch_at === "string" && settings.launch_at ? settings.launch_at : null,
    };
    cachedAt = now;
    return cachedSettings;
  } catch {
    // Keep the public site closed if the launch setting cannot be read.
    return { enabled: true, launch_at: null };
  }
}
