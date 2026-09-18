"use client";

import { useState } from "react";

function ActionForm({ action, storeId, children, onDone, submitLabel = "Save", busyLabel = "Saving…" }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/ops", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "Unable to save.");
    event.currentTarget.reset();
    onDone?.(data);
  }
  return <form onSubmit={submit} className="space-y-3">{children}{storeId && <input type="hidden" name="storeId" value={storeId} />}{error && <p className="error">{error}</p>}<button className="btn-primary" disabled={busy}>{busy ? busyLabel : submitLabel}</button></form>;
}

export function CancelOrderForm({ order, orderId, sellerAvailable = 0, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paid = order?.payment_status === "paid";
  const total = Number(order?.payment_total || order?.total || 0);
  const available = Number(sellerAvailable || 0);
  async function confirm() {
    if (reason.trim().length < 3) return setError("Enter a cancellation reason.");
    setBusy(true);
    setError("");
    const response = await fetch("/api/ops", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel", orderId: order?.id || orderId, reason: reason.trim() }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "Unable to cancel this order.");
    setOpen(false);
    onDone?.(data);
    window.location.reload();
  }
  return <>
    <button type="button" className="text-[11px] font-bold text-danger underline underline-offset-4" onClick={() => { setError(""); setOpen(true); }}>Cancel order</button>
    {open && <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-danger">Seller action</p><h2 id="cancel-order-title" className="display mt-2 text-2xl">{paid ? "Cancel this paid order?" : "Cancel this order?"}</h2></div><button type="button" className="btn-soft px-3 py-2 text-xs" onClick={() => setOpen(false)} disabled={busy}>Keep order</button></div>
        <p className="mt-3 text-sm leading-6 text-muted">{paid ? `This customer has already paid for this order. Cancelling it will create a full refund of ${total.toLocaleString("en-NG", { style: "currency", currency: "NGN" })} that must be returned to the buyer.` : "This unpaid order will be cancelled and the reserved stock will be returned."}</p>
        <dl className="mt-5 grid gap-3 rounded-2xl bg-surface p-4 text-xs sm:grid-cols-2"><div><dt className="text-muted">Order number</dt><dd className="mt-1 font-extrabold">#{order?.order_code || "—"}</dd></div><div><dt className="text-muted">Buyer</dt><dd className="mt-1 font-extrabold">{order?.customers?.name || "Buyer"}</dd></div><div><dt className="text-muted">Store</dt><dd className="mt-1 font-extrabold">{order?.store_name || "Your store"}</dd></div><div><dt className="text-muted">Original payment</dt><dd className="mt-1 font-extrabold">{total.toLocaleString("en-NG", { style: "currency", currency: "NGN" })}</dd></div>{paid && <><div><dt className="text-muted">Refund amount</dt><dd className="mt-1 font-extrabold text-danger">{total.toLocaleString("en-NG", { style: "currency", currency: "NGN" })}</dd></div><div><dt className="text-muted">Available seller balance</dt><dd className={`mt-1 font-extrabold ${available >= total ? "text-success" : "text-warning"}`}>{available.toLocaleString("en-NG", { style: "currency", currency: "NGN" })}</dd></div></>}</dl>
        <label className="mt-5 block text-xs font-extrabold">Cancellation reason<textarea className="input mt-2 min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: item was unavailable" maxLength={500} required /></label>
        {paid && available < total && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-warning">Your balance is short by {(total - available).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}. After cancellation, Sella will keep the refund open until the full amount is funded.</p>}
        {error && <p className="mt-3 text-xs font-bold text-danger" role="alert">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" className="btn-soft" onClick={() => setOpen(false)} disabled={busy}>Keep Order</button><button type="button" className="btn-danger" onClick={confirm} disabled={busy}>{busy ? "Cancelling…" : "Confirm Cancellation"}</button></div>
      </div>
    </div>}
  </>;
}

export function WithdrawalForm({ storeId, account, withdrawalFee = 120, onDone }) { return <ActionForm action="withdraw" storeId={storeId} onDone={onDone} submitLabel="Process Withdrawal" busyLabel="Processing…"><label className="label">Amount to withdraw</label><input className="input" name="amount" type="number" min={Number(withdrawalFee) + 0.01} step="0.01" required /><p className="text-xs leading-5 text-muted">Sella deducts the current {Number(withdrawalFee).toLocaleString("en-NG", { style: "currency", currency: "NGN" })} payout fee. The remaining amount is sent to your bank account.</p><label className="label">Bank name</label><input className="input" name="bankName" defaultValue={account?.bank_name || ""} required /><label className="label">Account number</label><input className="input" name="accountNumber" inputMode="numeric" defaultValue={account?.account_number || ""} required /><label className="label">Account name</label><input className="input" name="accountName" defaultValue={account?.account_name || ""} required /></ActionForm>; }
export function OfflineSaleForm({ storeId, onDone }) { return <ActionForm action="offline_sale" storeId={storeId} onDone={onDone}><label className="label">Sale amount</label><input className="input" name="amount" type="number" min="0" step="0.01" required /><label className="label">Payment method</label><select className="input" name="paymentMethod"><option value="cash">Cash</option><option value="transfer">Transfer</option><option value="pos">POS</option><option value="other">Other</option></select><label className="label">Notes</label><textarea className="input" name="notes" /></ActionForm>; }
export function BankAccountForm({ storeId, account, onDone }) { return <ActionForm action="bank_account" storeId={storeId} onDone={onDone}><label className="label">Bank name</label><input className="input" name="bankName" defaultValue={account?.bank_name || ""} required /><label className="label">Account number</label><input className="input" name="accountNumber" defaultValue={account?.account_number || ""} required /><label className="label">Account name</label><input className="input" name="accountName" defaultValue={account?.account_name || ""} required /></ActionForm>; }
export function VerificationForm({ storeId, store, onDone }) { return <ActionForm action="verification" storeId={storeId} onDone={onDone}><label className="label">Legal name</label><input className="input" name="legalName" defaultValue={store?.legal_name || ""} /><label className="label">NIN</label><input className="input" name="nin" inputMode="numeric" minLength={11} maxLength={11} defaultValue={store?.nin || ""} /><label className="label">CAC number</label><input className="input" name="cacNumber" defaultValue={store?.cac_number || ""} /><label className="label">CAC certificate URL</label><input className="input" name="cacFileUrl" type="url" defaultValue={store?.cac_file_url || ""} placeholder="Upload in Settings or paste a file URL" /></ActionForm>; }
