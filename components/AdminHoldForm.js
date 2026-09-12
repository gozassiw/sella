"use client";
import { useState } from "react";

export default function AdminHoldForm({ account }) {
  const held = account.hold?.status === "held";
  const [role, setRole] = useState(account.hold?.role || (account.seller_store ? "seller" : "buyer"));
  const [reason, setReason] = useState(account.hold?.reason || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "account_hold", userId: account.user_id, role, held: !held, reason }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to update account.");
    setMessage(held ? "Released" : "Held");
    window.location.reload();
  }
  return <div className="min-w-[220px] space-y-2"><div className="flex gap-2"><select className="input py-2 text-xs" value={role} onChange={(event) => setRole(event.target.value)} disabled={held}><option value="buyer">Buyer</option><option value="seller">Seller</option><option value="both">Both</option></select><button type="button" onClick={submit} disabled={busy} className={held ? "btn-soft px-3 py-2 text-xs" : "btn-danger px-3 py-2 text-xs"}>{busy ? "…" : held ? "Release" : "Hold"}</button></div>{!held && <input className="input py-2 text-xs" placeholder="Reason for hold" value={reason} onChange={(event) => setReason(event.target.value)} required />}{message && <p className="text-right text-[11px] text-muted">{message}</p>}</div>;
}
