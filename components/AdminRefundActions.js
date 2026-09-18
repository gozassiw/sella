"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function AdminRefundActions({ refundId, canRetry, linkedWithdrawals = [] }) {
  const router = useRouter(); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(action, body) {
    setBusy(true); setError("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...body, refundId }) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok || data?.success !== true) return setError(data.error || data.message || "Admin action failed; no refund credit was recorded.");
    setNote(""); router.refresh();
  }
  return <div className="space-y-3"><div className="rounded-xl bg-surface p-3 text-xs"><p className="font-extrabold">Linked withdrawals</p>{linkedWithdrawals.length ? <div className="mt-2 space-y-2">{linkedWithdrawals.map((item) => <div key={item.id} className="border-t border-line pt-2"><p className="font-bold">{item.id} · {item.status === "paid" ? "Completed — not reversible" : item.status === "rejected" ? "Rejected — funds released" : `${item.status} — requires review`}</p><p className="mt-1 text-muted">Amount ₦{Number(item.amount || 0).toLocaleString()} · payout ₦{Number(item.payout_amount || 0).toLocaleString()} · created {item.created_at ? new Date(item.created_at).toLocaleString("en-NG") : "—"} · processed {item.processed_at ? new Date(item.processed_at).toLocaleString("en-NG") : "—"}</p>{item.settlement_reference && <p className="mt-1 text-muted">Settlement reference: {item.settlement_reference}</p>}</div>)}</div> : <p className="mt-1 text-muted">No linked withdrawals.</p>}</div><div className="flex flex-wrap gap-2">{canRetry && <button type="button" disabled={busy} onClick={() => submit("refund_retry", {})} className="btn-soft px-3 py-2 text-xs">Safe retry</button>}<a href="/admin?section=reports" className="btn-soft px-3 py-2 text-xs">Escalate / support</a></div><form onSubmit={(e) => { e.preventDefault(); submit("refund_note", { noteAction: "note", body: note }); }} className="flex gap-2"><input value={note} onChange={(e) => setNote(e.target.value)} required placeholder="Admin note / seller explanation" className="input min-w-0 flex-1 text-xs" /><button disabled={busy} className="btn-primary px-3 py-2 text-xs">Record</button></form>{error && <p className="text-xs text-danger">{error}</p>}</div>;
}