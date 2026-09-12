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
  try {
    const admin = createAdminClient();
    if (save) await admin.from("notifications").insert({ user_id: userId, type, title, body, link });
    let pushed = 0;
    if (configureWebPush()) {
      const { data: subscriptions } = await admin.from("push_subscriptions").select("id,subscription").eq("user_id", userId).limit(20);
      for (const row of subscriptions || []) {
        try {
          await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, link }));
          pushed += 1;
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) await admin.from("push_subscriptions").delete().eq("id", row.id);
        }
      }
    }
    return { saved: true, pushed };
  } catch (error) {
    console.error("Notification delivery failed", error);
    return { saved: false, pushed: 0 };
  }
}

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
