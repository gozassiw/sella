import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let vapidConfigured = false;
function configureWebPush() {
  if (vapidConfigured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

export async function notifyUser({ userId, type = "system", title, body, link = null, save = true }) {
  if (!userId || !title || !body) return { saved: false, pushed: 0 };
  let saved = !save;
  try {
    let admin = null;
    if (save) {
      admin = createAdminClient();
      const { error } = await admin.from("notifications").insert({ user_id: userId, type, title, body, link });
      if (error) throw error;
      saved = true;
    }
    let pushed = 0;
    if (configureWebPush()) {
      try { admin ||= createAdminClient(); } catch (error) { console.error("Phone notification server client unavailable", error); }
      if (admin) {
        const { data: subscriptions } = await admin.from("push_subscriptions").select("id,subscription").eq("user_id", userId).limit(20);
        for (const row of subscriptions || []) {
          try {
            await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, link }));
            pushed += 1;
          } catch (error) {
            if ([404, 410].includes(error.statusCode)) await admin.from("push_subscriptions").delete().eq("id", row.id);
            else console.error("Phone notification send failed", error);
          }
        }
      }
    }
    return { saved, pushed };
  } catch (error) {
    console.error("Notification delivery failed", error);
    return { saved, pushed: 0 };
  }
}

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
