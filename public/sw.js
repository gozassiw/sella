self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() || "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "Sella", { body: data.body || "You have a new Sella update.", icon: "/brand/sella-mark.png", badge: "/brand/sella-mark.png", data: { link: data.link || "/account" }, tag: `sella-${Date.now()}` }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/account";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((window) => "focus" in window);
    if (existing) { existing.navigate(link); return existing.focus(); }
    return clients.openWindow(link);
  }));
});
