"use client";

import { Copy, Link2, RefreshCw, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";

function formatDate(value) {
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default function PreviewLinkManager() {
  const [duration, setDuration] = useState("1d");
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadLinks() {
    const response = await fetch("/api/admin/preview-links", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setLinks(data.links || []);
  }

  useEffect(() => { loadLinks(); }, []);

  async function generate() {
    setBusy(true);
    setMessage("");
    setNewLink("");
    const response = await fetch("/api/admin/preview-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ duration }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || "Could not generate link.");
      return;
    }
    setNewLink(data.link);
    setMessage(`Link created. It expires ${formatDate(data.expiresAt)}.`);
    loadLinks();
  }

  async function copyLink() {
    if (!newLink) return;
    await navigator.clipboard.writeText(newLink);
    setMessage("Link copied. Send it only to the tester.");
  }

  async function revoke(id) {
    const response = await fetch("/api/admin/preview-links", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Could not revoke link.");
      return;
    }
    setMessage("Tester link revoked.");
    loadLinks();
  }

  return (
    <div className="mt-5 rounded-2xl border border-line p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-kola-light text-kola"><Link2 size={17} /></span><div><p className="text-sm font-extrabold">Tester access links</p><p className="mt-1 text-xs leading-5 text-muted">Generate a temporary link to the normal Sella site. The permanent preview secret is never shown here.</p></div></div>
      <div className="mt-4 flex flex-wrap items-end gap-3"><div><label className="label" htmlFor="preview-duration">Link lasts</label><select id="preview-duration" className="input w-auto min-w-32" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="1h">1 hour</option><option value="1d">1 day</option><option value="7d">7 days</option><option value="30d">30 days</option></select></div><button type="button" className="btn-primary" onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate tester link"}</button></div>
      {newLink && <div className="mt-4 flex flex-col gap-3 rounded-xl bg-kola-light p-3 sm:flex-row sm:items-center"><input readOnly value={newLink} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-kola outline-none" aria-label="New tester link" /><button type="button" className="btn-soft shrink-0 px-3 py-2 text-xs" onClick={copyLink}><Copy size={14} /> Copy link</button></div>}
      {message && <p className="mt-3 text-xs font-bold text-muted">{message}</p>}
      <div className="mt-5 border-t border-line pt-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold text-ink">Recent links</p><button type="button" onClick={loadLinks} className="btn-soft px-2.5 py-1.5 text-xs" aria-label="Refresh tester links"><RefreshCw size={13} /></button></div><div className="mt-3 space-y-2">{links.length ? links.map((link) => <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-xs"><div><p className="font-bold text-ink">{link.revoked_at ? "Revoked" : new Date(link.expires_at) <= new Date() ? "Expired" : "Active tester link"}</p><p className="mt-1 text-muted">Expires {formatDate(link.expires_at)}{link.last_used_at ? ` · Last used ${formatDate(link.last_used_at)}` : ""}</p></div>{!link.revoked_at && new Date(link.expires_at) > new Date() && <button type="button" onClick={() => revoke(link.id)} className="inline-flex items-center gap-1 font-bold text-danger"><ShieldX size={14} /> Revoke</button>}</div>) : <p className="text-xs text-muted">No tester links generated yet.</p>}</div></div>
    </div>
  );
}
