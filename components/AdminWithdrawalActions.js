"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WithdrawalReceiptForm from "@/components/WithdrawalReceiptForm";

export default function AdminWithdrawalActions({ item }) {
  const router = useRouter();
  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const final = ["paid", "sent", "rejected"].includes(item.status);
  const statusLabel = ["paid", "sent"].includes(item.status) ? "Payout completed" : item.status === "processing" ? "Banking confirmation pending" : item.status;
  async function action(status, confirmation = {}, note = "") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "withdrawal_status", withdrawalId: item.id, status, confirmation, note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The payout could not be updated.");
      setMode(""); setAcknowledged(false); router.refresh();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  function submit(event) {
    event.preventDefault(); if (!acknowledged || busy) return;
    const fields = new FormData(event.currentTarget);
    if (mode === "paid") action("paid", { bank_success_checked: true, channel: fields.get("channel"), reference: fields.get("reference"), amount: fields.get("amount"), paid_at: new Date(fields.get("paidAt")).toISOString() }, fields.get("note"));
    else action("rejected", { not_settled_checked: true }, fields.get("note"));
  }
  function open(value) { setMode(value); setAcknowledged(false); setMessage(""); }
  return <div className="w-full max-w-md space-y-3">
    <p className={`text-xs font-bold capitalize ${item.status === "rejected" ? "text-danger" : "text-kola"}`}>{statusLabel || "Pending"}</p>
    {!final && <div className="flex flex-wrap gap-2">
      {item.status === "pending" && <button type="button" className="btn-soft text-xs" disabled={busy} onClick={() => action("processing")}>Review payout</button>}
      {item.status === "processing" && <>{!item.receipt_path ? <WithdrawalReceiptForm withdrawalId={item.id} /> : <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => open("paid")}>Confirm bank settlement</button>}</>}
      <button type="button" className="btn-soft text-xs" disabled={busy} onClick={() => open("rejected")}>Review cancellation / failed payout</button>
    </div>}
    {mode && !final && <form onSubmit={submit} className="space-y-3 rounded-xl border border-line p-4">
      <p className="text-sm font-bold">{mode === "paid" ? "Confirm the bank shows a successful payment" : "Confirm no payment was settled"}</p>
      <p className="text-xs leading-5 text-muted">{mode === "paid" ? "Check the actual bank or payment-provider channel: successful status, correct recipient and exact net amount. An uploaded receipt or reference alone is not settlement confirmation. This records your manual check, not an automated bank verification." : "Do not cancel a transfer that is pending, uncertain or already successful. Check the banking channel first. Only a confirmed failed, cancelled or unsent payment can be returned to the seller balance."}</p>
      {mode === "paid" && <>
        <label className="block text-xs font-bold">Bank / payment channel<input className="input mt-1" name="channel" required maxLength={120} /></label>
        <label className="block text-xs font-bold">Successful settlement reference<input className="input mt-1" name="reference" required maxLength={180} /></label>
        <label className="block text-xs font-bold">Confirmed paid amount (₦)<input className="input mt-1" name="amount" type="number" min="0" step="0.01" required placeholder={String(item.payout_amount ?? Number(item.amount) - Number(item.fee || 0))} /></label>
        <label className="block text-xs font-bold">Actual payment date and time<input className="input mt-1" name="paidAt" type="datetime-local" required /></label>
      </>}
      <label className="block text-xs font-bold">{mode === "paid" ? "Review note (optional)" : "Cancellation reason and banking check"}<textarea className="input mt-1" name="note" required={mode !== "paid"} minLength={mode !== "paid" ? 8 : undefined} maxLength={2000} rows={3} /></label>
      <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1 accent-[#087a55]" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />{mode === "paid" ? "I checked the banking channel and confirmed this payout settled successfully to the correct recipient for the exact net amount." : "I checked that this payout was not settled. It is safe to return this withdrawal amount once."}</label>
      <div className="flex gap-2"><button className="btn-primary text-xs disabled:opacity-50" disabled={!acknowledged || busy}>{busy ? "Saving…" : mode === "paid" ? "Record payout completed" : "Cancel and return balance"}</button><button className="btn-soft text-xs" type="button" disabled={busy} onClick={() => open("")}>Back</button></div>
    </form>}
    {message && <p role="alert" className="text-xs text-danger">{message}</p>}
  </div>;
}
