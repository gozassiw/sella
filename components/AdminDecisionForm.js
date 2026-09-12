"use client";
import { useState } from "react";

export default function AdminDecisionForm({ storeId }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  async function decide(approvalStatus) {
    if (approvalStatus === "rejected" && !reason.trim()) return setMessage("Add a reason first.");
    setBusy(approvalStatus); setMessage("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "store_approval", storeId, approvalStatus, reason: reason.trim() }) });
    const data = await response.json().catch(() => ({}));
    setBusy(""); setMessage(response.ok ? "Saved" : data.error || "Failed");
    if (response.ok) window.location.reload();
  }
  return <div className="min-w-[210px] space-y-2"><input className="input w-full text-xs" placeholder="Rejection reason (if needed)" value={reason} onChange={(event) => setReason(event.target.value)} /><div className="flex justify-end gap-2"><button type="button" onClick={() => decide("rejected")} disabled={!!busy} className="btn-secondary px-3 py-2 text-xs text-danger">{busy === "rejected" ? "…" : "Reject"}</button><button type="button" onClick={() => decide("approved")} disabled={!!busy} className="btn-primary px-3 py-2 text-xs">{busy === "approved" ? "…" : "Approve"}</button></div>{message && <p className="text-right text-[11px] text-muted">{message}</p>}</div>;
}
