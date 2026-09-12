"use client";
import { useState } from "react";

export default function AdminVerificationForm({ storeId, approved }) {
  const [busy, setBusy] = useState(false);
  async function update(value) {
    setBusy(true);
    await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "verification", storeId, approved: value }) });
    setBusy(false); window.location.reload();
  }
  return <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy || approved} onClick={() => update(true)} className="btn-secondary px-3 py-2 text-xs">{approved ? "Approved" : "Approve verification"}</button>{approved && <button type="button" disabled={busy} onClick={() => update(false)} className="text-xs font-bold text-danger">Revoke</button>}</div>;
}
