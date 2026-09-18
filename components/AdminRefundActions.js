"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

export default function AdminRefundActions({ refund }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  async function run(action) {
    setBusy(action);
    setMessage("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "refund_action", refundId: refund.id, refundAction: action, note }) });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Admin refund action failed.");
    setMessage(action === "retry" ? (data.refunded ? "Refund completed." : "Refund is still awaiting funds.") : "Admin action recorded.");
    setNote("");
    router.refresh();
  }
  return <div className="mt-4 rounded-2xl bg-surface p-4"><div className="grid gap-2 text-xs sm:grid-cols-3"><div><p className="text-muted">Available seller funds</p><p className="mt-1 font-extrabold">{formatNaira(refund.available_seller_funds)}</p></div><div><p className="text-muted">Full refund due</p><p className="mt-1 font-extrabold text-danger">{formatNaira(refund.refund_due)}</p></div><div><p className="text-muted">Outstanding seller contribution</p><p className="mt-1 font-extrabold text-warning">{formatNaira(refund.outstanding_seller_contribution)}</p></div></div><textarea className="input mt-4 min-h-20 text-xs" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Review note or seller explanation" maxLength={2000} /><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-primary text-xs" disabled={busy !== ""} onClick={() => run("retry")}>{busy === "retry" ? "Retrying…" : "Retry refund"}</button><button type="button" className="btn-soft text-xs" disabled={busy !== "" || !note.trim()} onClick={() => run("note")}>Record note</button><button type="button" className="btn-soft text-xs" disabled={busy !== "" || !note.trim()} onClick={() => run("escalated")}>Escalate to Reports & Safety</button></div>{message && <p className="mt-3 text-xs font-bold text-kola" role="status">{message}</p>}</div>;
}
