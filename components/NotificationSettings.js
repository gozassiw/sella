"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, ExternalLink } from "lucide-react";

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setItems(data.notifications || []);
    if (typeof window !== "undefined" && "Notification" in window) setPermission(Notification.permission);
    setPushReady(Boolean(data.pushConfigured));
  }
  useEffect(() => { load(); }, []);

  async function enablePush() {
    setBusy(true); setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("This browser does not support phone notifications.");
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error("Notifications were not enabled. Allow them in your browser settings and try again.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const keyResponse = await fetch("/api/notifications/vapid-public-key", { cache: "no-store" });
      const { key } = await keyResponse.json();
      if (!key) throw new Error("Phone notifications are not configured yet. Sella Team needs to add the notification keys.");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToBytes(key) });
      const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not save notification settings.");
      setMessage("Notifications are on for this device.");
    } catch (error) { setMessage(error.message || "Notifications could not be enabled."); }
    setBusy(false);
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-kola">Notifications</p><h1 className="display mt-2 text-3xl">Stay in the loop</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Receive important Sella updates about verification, orders, wallet transfers, account holds, and plan payments.</p></div><button type="button" onClick={markAllRead} className="btn-soft inline-flex items-center gap-2"><CheckCheck size={16} />Mark all read</button></header>
    <section className="app-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-kola-light text-kola"><Bell size={20} /></span><div><p className="font-extrabold">Phone notifications</p><p className="mt-1 text-xs text-muted">Works after you install Sella as a web app and allow notifications.</p></div></div><button type="button" onClick={enablePush} disabled={busy || !pushReady} className="btn-primary inline-flex items-center gap-2">{busy ? "Turning on…" : permission === "granted" ? "Notifications on" : "Turn on notifications"}</button></div>{!pushReady && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-warning">Phone notification delivery is not configured on this deployment yet. In-app notifications still work.</p>}{permission === "denied" && <p className="mt-4 flex items-center gap-2 text-xs text-danger"><BellOff size={15} />Your browser has blocked notifications. Allow them in site settings, then try again.</p>}{message && <p className="mt-4 text-xs font-bold text-kola">{message}</p>}</section>
    <section className="space-y-3">{items.length ? items.map((item) => <article key={item.id} className={`app-card flex gap-3 p-4 ${item.read_at ? "opacity-70" : "border-kola/30"}`}><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-kola-light text-kola"><Bell size={16} /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{item.title}</p><p className="mt-1 text-sm leading-6 text-muted">{item.body}</p><div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted"><span>{timeLabel(item.created_at)}</span>{item.link && <Link href={item.link} className="inline-flex items-center gap-1 font-bold text-kola">Open <ExternalLink size={12} /></Link>}</div></div></article>) : <div className="app-card p-10 text-center"><Bell size={24} className="mx-auto text-muted" /><p className="mt-3 text-sm font-extrabold">No notifications yet</p><p className="mt-2 text-xs text-muted">Important account activity will appear here.</p></div>}</section>
  </div>;
}
