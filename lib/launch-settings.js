import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

async function readPublicLaunchSettings() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "launch_mode")
      .maybeSingle();
    const value = data?.value && typeof data.value === "object" ? data.value : {};
    return {
      enabled: value.enabled === true,
      launch_at: typeof value.launch_at === "string" && value.launch_at ? value.launch_at : null,
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
