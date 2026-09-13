"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function timeLabel(value) {
  try { return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return ""; }
}
function vapidKeyToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

export default function NotificationSettings() {
  const [items, setItems] = useState([]);
  const [pushReady, setPushReady] = useState(false);
  const [permission, setPermission] = useState("default");
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setItems(data.notifications || []);
    if (typeof window !== "undefined" && "Notification" in window) setPermission(Notification.permission);
    setPushReady(Boolean(data.pushConfigured));
    setDeviceRegistered(Boolean(data.deviceRegistered));
  }
  useEffect(() => {
    let active = true;
    let channel;
    const supabase = createClient();
    const connect = async () => {
      await load();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      channel = supabase.channel(`sella-notifications-page-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load);
      channel.subscribe();
    };
    connect();
    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, []);

  async function enablePush() {
    setBusy(true); setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("This browser does not support phone notifications.");
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error("Notifications were not enabled. Allow them in your browser settings and try again.");
      const registration = await navigator.serviceWorker.register("/sw.js?v=android-push-3", { updateViaCache: "none" });
      await registration.update().catch(() => {});
      const keyResponse = await fetch("/api/notifications/vapid-public-key", { cache: "no-store" });
      const { key } = await keyResponse.json();
      if (!key) throw new Error("Phone notifications are not configured yet. Sella Team needs to add the notification keys.");
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) await existingSubscription.unsubscribe().catch(() => {});
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToBytes(key) });
      const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not save notification settings.");
      setDeviceRegistered(true);
      setMessage("Notifications are on for this device.");
    } catch (error) { setMessage(error.message || "Notifications could not be enabled."); }
    setBusy(false);
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
  }

  async function sendTest() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test: true }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "The test notification could not be sent.");
    setMessage(data.pushed > 0 ? `Test notification sent to ${data.pushed} phone device${data.pushed === 1 ? "" : "s"}.` : data.pushError ? `Dashboard notification saved, but phone push failed: ${data.pushError}` : data.attempted === 0 ? "Dashboard notification saved, but Sella found no server-side phone subscription for this account." : `Sella attempted ${data.attempted} phone device${data.attempted === 1 ? "" : "s"}, but none accepted the notification.`);
    load();
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-kola">Notifications</p><h1 className="display mt-2 text-3xl">Stay in the loop</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Receive important Sella updates about verification, orders, wallet transfers, account holds, and plan payments.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={sendTest} disabled={busy} className="btn-soft inline-flex items-center gap-2">Send test</button><button type="button" onClick={markAllRead} className="btn-soft inline-flex items-center gap-2"><CheckCheck size={16} />Mark all read</button></div></header>
    <section className="app-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-kola-light text-kola"><Bell size={20} /></span><div><p className="font-extrabold">Phone notifications</p><p className="mt-1 text-xs text-muted">Works after you install Sella as a web app and allow notifications.</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={enablePush} disabled={busy || !pushReady} className="btn-primary inline-flex items-center gap-2">{busy ? "Refreshing…" : deviceRegistered ? "Refresh phone" : "Turn on notifications"}</button>{deviceRegistered && <button type="button" onClick={sendTest} disabled={busy} className="btn-soft inline-flex items-center gap-2">Test phone</button>}</div></div>{!pushReady && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-warning">Phone alerts are not available because the server notification keys are missing. Sella can still save in-app notifications.</p>}{pushReady && deviceRegistered && <p className="mt-4 rounded-xl bg-kola-light p-3 text-xs font-bold text-kola">This device is registered. New order, wallet, delivery, and withdrawal alerts can be sent here.</p>}{permission === "denied" && <p className="mt-4 flex items-center gap-2 text-xs text-danger"><BellOff size={15} />Your browser has blocked notifications. Allow them in site settings, then try again.</p>}{message && <p className="mt-4 text-xs font-bold text-kola">{message}</p>}</section>
    <section className="space-y-3">{items.length ? items.map((item) => <article key={item.id} className={`app-card flex gap-3 p-4 ${item.read_at ? "opacity-70" : "border-kola/30"}`}><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-kola-light text-kola"><Bell size={16} /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{item.title}</p><p className="mt-1 text-sm leading-6 text-muted">{item.body}</p><div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted"><span>{timeLabel(item.created_at)}</span>{item.link && <Link href={item.link} className="inline-flex items-center gap-1 font-bold text-kola">Open <ExternalLink size={12} /></Link>}</div></div></article>) : <div className="app-card p-10 text-center"><Bell size={24} className="mx-auto text-muted" /><p className="mt-3 text-sm font-extrabold">No notifications yet</p><p className="mt-2 text-xs text-muted">Important account activity will appear here.</p></div>}</section>
  </div>;
}
