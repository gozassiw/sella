"use client";

import { useState } from "react";

function ActionForm({ action, storeId, children, onDone }) {
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
  return <form onSubmit={submit} className="space-y-3">{children}{storeId && <input type="hidden" name="storeId" value={storeId} />}{error && <p className="error">{error}</p>}<button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></form>;
}

export function CancelOrderForm({ orderId, onDone }) { return <ActionForm action="cancel" onDone={onDone}><input type="hidden" name="orderId" value={orderId} /><label className="label">Cancellation reason</label><input className="input" name="reason" placeholder="Optional reason" /><button className="btn-danger" disabled={false}>Cancel and restock</button></ActionForm>; }
export function WithdrawalForm({ storeId, account, onDone }) { return <ActionForm action="withdraw" storeId={storeId} onDone={onDone}><label className="label">Amount to withdraw</label><input className="input" name="amount" type="number" min="121" step="0.01" required /><p className="text-xs leading-5 text-muted">Sella deducts the fixed ₦120 withdrawal fee. The remaining amount is sent to your bank account.</p><label className="label">Bank name</label><input className="input" name="bankName" defaultValue={account?.bank_name || ""} required /><label className="label">Account number</label><input className="input" name="accountNumber" inputMode="numeric" defaultValue={account?.account_number || ""} required /><label className="label">Account name</label><input className="input" name="accountName" defaultValue={account?.account_name || ""} required /></ActionForm>; }
export function OfflineSaleForm({ storeId, onDone }) { return <ActionForm action="offline_sale" storeId={storeId} onDone={onDone}><label className="label">Sale amount</label><input className="input" name="amount" type="number" min="0" step="0.01" required /><label className="label">Payment method</label><select className="input" name="paymentMethod"><option value="cash">Cash</option><option value="transfer">Transfer</option><option value="pos">POS</option><option value="other">Other</option></select><label className="label">Notes</label><textarea className="input" name="notes" /></ActionForm>; }
export function BankAccountForm({ storeId, account, onDone }) { return <ActionForm action="bank_account" storeId={storeId} onDone={onDone}><label className="label">Bank name</label><input className="input" name="bankName" defaultValue={account?.bank_name || ""} required /><label className="label">Account number</label><input className="input" name="accountNumber" defaultValue={account?.account_number || ""} required /><label className="label">Account name</label><input className="input" name="accountName" defaultValue={account?.account_name || ""} required /></ActionForm>; }
export function VerificationForm({ storeId, store, onDone }) { return <ActionForm action="verification" storeId={storeId} onDone={onDone}><label className="label">Legal name</label><input className="input" name="legalName" defaultValue={store?.legal_name || ""} /><label className="label">NIN</label><input className="input" name="nin" inputMode="numeric" minLength={11} maxLength={11} defaultValue={store?.nin || ""} /><label className="label">CAC number</label><input className="input" name="cacNumber" defaultValue={store?.cac_number || ""} /><label className="label">CAC certificate URL</label><input className="input" name="cacFileUrl" type="url" defaultValue={store?.cac_file_url || ""} placeholder="Upload in Settings or paste a file URL" /></ActionForm>; }
