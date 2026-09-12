self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() || "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "Sella", {
    body: data.body || "You have a new Sella update.",
    icon: data.icon || "/brand/sella-mark.png",
    badge: data.badge || "/brand/sella-mark.png",
    tag: data.tag || `sella-${Date.now()}`,
    data: { url: data.url || data.link || "/account" },
    renotify: Boolean(data.renotify),
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/account";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((window) => "focus" in window);
    if (existing) { existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const keyResponse = await fetch("/api/notifications/vapid-public-key", { credentials: "include", cache: "no-store" });
      const { key } = await keyResponse.json();
      if (!key) return;
      const normalized = key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "=");
      const applicationServerKey = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
      const subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await fetch("/api/notifications", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription }) });
    } catch (_) {
      // The next explicit refresh from the Notifications screen can repair the device.
    }
  })());
});
