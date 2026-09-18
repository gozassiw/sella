"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw } from "lucide-react";
import { formatNaira } from "@/lib/utils";

export default function RefundActions({ refund }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState(() => refund.funding_account_number && refund.funding_account_expires_at && new Date(refund.funding_account_expires_at) > new Date() ? {
    amount: refund.funding_account_amount || refund.outstanding_seller_contribution,
    accountNumber: refund.funding_account_number,
    accountName: refund.funding_account_name,
    bankName: refund.funding_bank_name,
    reference: refund.funding_account_reference || refund.refund_reference,
    expiresAt: refund.funding_account_expires_at,
  } : null);

  async function processRefund() {
    setBusy("process");
    setMessage("");
    const response = await fetch("/api/refunds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "process", refundId: refund.id }) });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Refund processing failed.");
    if (data.insufficient_funds) return setMessage(`Refund still needs ${formatNaira(data.outstanding_seller_contribution)}. Fund the shortfall before trying again.`);
    setMessage(data.refunded ? "Refund completed and the buyer’s Sella wallet was credited." : "Refund is still pending review.");
    router.refresh();
  }

  async function requestFundingAccount() {
    setBusy("fund");
    setMessage("");
    const response = await fetch("/api/refunds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "fund", refundId: refund.id }) });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to create the refund funding account.");
    setAccount(data);
  }

  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setMessage("Copied."); } catch { setMessage("Copy failed. Press and hold the account number to copy it."); }
  }

  const pendingFunding = refund.refund_status === "pending_funding" || Number(refund.outstanding_seller_contribution) > 0;
  return <div className="mt-4 space-y-3 rounded-2xl bg-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-ink">Refund actions</p><p className="mt-1 text-[11px] leading-5 text-muted">The seller must fund the full original order amount. Sella’s original commission is not reversed.</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-warning">{refund.refund_status.replaceAll("_", " ")}</span></div>
    <div className="flex flex-wrap gap-2">{!pendingFunding && <button type="button" className="btn-primary text-xs" disabled={busy !== "" || refund.refund_status === "refunded"} onClick={processRefund}>{busy === "process" ? "Processing…" : "Process full refund"}</button>}{pendingFunding && <button type="button" className="btn-soft inline-flex items-center gap-2 text-xs" disabled={busy !== ""} onClick={requestFundingAccount}>{busy === "fund" ? "Preparing…" : account ? "View refund account" : "Generate refund account"}</button>}{refund.linked_withdrawal_status && <span className="inline-flex items-center rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-warning">Pending withdrawal: {refund.linked_withdrawal_status}</span>}</div>
    {account && <div className="rounded-2xl border border-kola/20 bg-white p-4 text-xs"><p className="font-extrabold text-kola">Deposit exactly {formatNaira(account.amount)} to this refund account</p><button type="button" onClick={() => copy(account.accountNumber)} className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl bg-kola-light px-3 py-3 text-left text-base font-extrabold text-kola"><span>{account.accountNumber}</span><Copy size={16} /></button><p className="mt-2 text-muted">{account.bankName || "Bank account"}{account.accountName ? ` · ${account.accountName}` : ""}</p><p className="mt-1 text-muted">Reference: {account.reference}. Expires {new Date(account.expiresAt).toLocaleString("en-NG")}.</p><p className="mt-2 leading-5 text-muted">Once the exact payment is verified by TransactPay, Sella will automatically debit the seller balance and credit the buyer’s wallet. No second refund button is needed.</p></div>}
    {message && <p className="flex items-center gap-2 text-xs font-bold text-kola" role="status"><RefreshCw size={13} />{message}</p>}
  </div>;
}
