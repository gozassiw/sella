"use client";
import { useState } from "react";

export default function AdminActionForm({ action, field, value, label, nextValue, children }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setMessage(""); const statusKey = action === "store_trust" ? "trusted" : action === "verification" ? "approved" : action === "withdrawal_status" ? "status" : action === "store_approval" ? "approvalStatus" : "status"; const body = { action, [field]: value, ...(nextValue !== undefined ? { [statusKey]: nextValue } : {}) }; const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json().catch(() => ({})); setBusy(false); setMessage(response.ok ? "Saved" : data.error || "Failed"); if (response.ok) window.location.reload(); }
  return <form onSubmit={submit} className="inline-flex items-center gap-2"><button className="btn-secondary" disabled={busy}>{label}</button>{children}<span className="text-xs text-muted">{message}</span></form>;
}
