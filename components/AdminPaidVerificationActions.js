"use client";
import { useState } from "react";

export default function AdminPaidVerificationActions({ purchase }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function update(approved) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "paid_verification", purchaseId: purchase.id, approved }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Could not save review.");
    window.location.reload();
  }
  if (!["paid", "approved", "rejected"].includes(purchase.status)) return <span className="text-xs text-muted">Waiting for payment</span>;
  return <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={busy || purchase.status === "approved"} onClick={() => update(true)}>{purchase.status === "approved" ? "Approved" : "Approve checkmark"}</button>{purchase.status !== "approved" && <button type="button" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-danger" disabled={busy} onClick={() => update(false)}>Reject</button>}{message && <span className="w-full text-xs text-danger">{message}</span>}</div>;
}
