import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

async function readPublicLaunchSettings() {
  try {
    const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.rpc("get_public_launch_settings");
    if (error) throw error;
    return {
      enabled: data?.enabled === true,
      launch_at: typeof data?.launch_at === "string" && data.launch_at ? data.launch_at : null,
    };
  } catch {
    return { enabled: false, launch_at: null };
  }
}

export const getPublicLaunchSettings = unstable_cache(
  readPublicLaunchSettings,
  ["sella-public-launch-settings"],
  { revalidate: 30, tags: ["sella-launch-settings"] }
);
