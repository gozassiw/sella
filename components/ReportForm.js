"use client";
import { useState } from "react";

export default function ReportForm({ storeId, orderId, type = "order" }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId, orderId, type, reason: form.get("reason"), details: form.get("details") }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false); setMessage(response.ok ? "Report submitted. Sella will review it." : data.error || "Unable to submit report.");
    if (response.ok) event.currentTarget.reset();
  }
  return <form onSubmit={submit} className="space-y-3"><select className="input" name="reason" required defaultValue=""><option value="" disabled>Choose a reason</option><option>Not received</option><option>Wrong item</option><option>Damaged</option><option>Not responding</option><option>Suspicious or scam behaviour</option><option>Fake products</option><option>Other</option></select><textarea className="input" name="details" placeholder="Add details (optional)" /><button className="btn-secondary" disabled={busy}>{busy ? "Sending…" : "Report"}</button>{message && <p className="text-sm text-muted">{message}</p>}</form>;
}
