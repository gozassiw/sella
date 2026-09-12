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
  let pushError = null;
  let pushEnabled = false;
  let attempted = 0;
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
      pushEnabled = true;
      try { admin ||= createAdminClient(); } catch (error) { pushError = error.message; console.error("Phone notification server client unavailable", error); }
      if (admin) {
        const { data: subscriptions } = await admin.from("push_subscriptions").select("id,endpoint,subscription,p256dh_key,auth_key").eq("user_id", userId).is("disabled_at", null).limit(20);
        attempted = (subscriptions || []).length;
        for (const row of subscriptions || []) {
          try {
            const subscription = row.subscription?.endpoint && row.subscription?.keys ? row.subscription : { endpoint: row.endpoint, keys: { p256dh: row.p256dh_key, auth: row.auth_key } };
            await webpush.sendNotification(subscription, JSON.stringify({ title, body, link, url: link }));
            await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), disabled_at: null }).eq("id", row.id);
            pushed += 1;
          } catch (error) {
            if ([404, 410].includes(error.statusCode)) await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", row.id);
            else { pushError = error.message || `HTTP ${error.statusCode || "unknown"}`; console.error("Phone notification send failed", error); }
          }
        }
      }
    }
    return { saved, pushed, attempted, pushEnabled, pushError };
  } catch (error) {
    console.error("Notification delivery failed", error);
    return { saved, pushed: 0, attempted, pushEnabled, pushError: error.message || "Notification delivery failed" };
  }
}

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
