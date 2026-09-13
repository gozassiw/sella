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

function safePushError(error) {
  const status = error?.statusCode ? `HTTP ${error.statusCode}` : "Push provider error";
  const message = String(error?.body || error?.message || "Unknown push provider error")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
  return `${status}: ${message}`;
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
        const { data: subscriptions, error: subscriptionError } = await admin.from("push_subscriptions").select("id,endpoint,subscription,p256dh_key,auth_key").eq("user_id", userId).is("disabled_at", null).limit(20);
        if (subscriptionError) throw subscriptionError;
        attempted = (subscriptions || []).length;
        for (const row of subscriptions || []) {
          try {
            const subscription = row.subscription?.endpoint && row.subscription?.keys ? row.subscription : { endpoint: row.endpoint, keys: { p256dh: row.p256dh_key, auth: row.auth_key } };
            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                title,
                body,
                link,
                url: link,
                icon: "/brand/sella-mark.png",
                badge: "/brand/sella-mark.png",
                vibrate: [180, 80, 180],
                renotify: true,
                requireInteraction: true,
              }),
              { urgency: "high", TTL: 86400 }
            );
            await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), last_failure_at: null, last_error: null, disabled_at: null }).eq("id", row.id);
            pushed += 1;
          } catch (error) {
            pushError = safePushError(error);
            const failure = { last_failure_at: new Date().toISOString(), last_error: pushError };
            if ([404, 410].includes(error.statusCode)) failure.disabled_at = new Date().toISOString();
            await admin.from("push_subscriptions").update(failure).eq("id", row.id);
            if (![404, 410].includes(error.statusCode)) console.error("Phone notification send failed", { statusCode: error.statusCode || null, message: pushError });
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

export async function notifyPlatformAdmins({ type = "system", title, body, link = "/admin" }) {
  if (!title || !body || !pushConfigured()) return { pushed: 0, attempted: 0 };
  try {
    const admin = createAdminClient();
    const { data: configured, error: configuredError } = await admin.from("platform_admins").select("email").limit(100);
    if (configuredError) throw configuredError;
    const emails = new Set((configured || []).map((row) => String(row.email || "").toLowerCase()).filter(Boolean));
    if (!emails.size) return { pushed: 0, attempted: 0 };
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;
    const adminIds = (users?.users || []).filter((user) => emails.has(String(user.email || "").toLowerCase())).map((user) => user.id);
    const results = await Promise.all(adminIds.map((userId) => notifyUser({ userId, type, title, body, link, save: false })));
    return { attempted: results.reduce((total, result) => total + Number(result.attempted || 0), 0), pushed: results.reduce((total, result) => total + Number(result.pushed || 0), 0) };
  } catch (error) {
    console.error("Platform admin phone notification failed", error);
    return { pushed: 0, attempted: 0, pushError: error.message || "Platform admin phone notification failed" };
  }
}
