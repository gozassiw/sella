"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Copy, WalletCards } from "lucide-react";
import { formatNaira } from "@/lib/utils";

export default function PaidVerificationForm({ storeId, price, balance, currentStatus, purchase }) {
  const [paymentMethod, setPaymentMethod] = useState(Number(balance) >= Number(price) ? "wallet" : "transfer");
  const [result, setResult] = useState(purchase || null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!result?.paymentAccountExpiresAt) return undefined;
    const update = () => setSecondsLeft(Math.max(0, Math.floor((new Date(result.paymentAccountExpiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [result?.paymentAccountExpiresAt]);

  async function submit() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/seller/verification-badge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId, amount: price, paidWith: paymentMethod }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to start verification payment.");
    if (paymentMethod === "wallet") {
      setMessage("Payment received. Sella Team will review your store.");
      window.setTimeout(() => window.location.reload(), 900);
      return;
    }
    setResult(data);
  }

  async function copy(value) { try { await navigator.clipboard.writeText(value); setMessage("Copied."); } catch { setMessage("Copy failed — press and hold the account number to copy it."); } }
  const countdown = secondsLeft === null ? "30 minutes" : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const expired = secondsLeft !== null && secondsLeft <= 0;

  if (currentStatus === "approved") return <div className="rounded-2xl bg-blue-50 p-5 text-[#1D4ED8]"><div className="flex items-center gap-2 font-extrabold"><BadgeCheck size={21} fill="currentColor" />Verification checkmark active</div><p className="mt-2 text-sm leading-6">Sella Team approved the separate review of your submitted identity and business information. The checkmark remains active until the six-month renewal date. It does not guarantee products, delivery or refunds, and does not place the store in a public discovery feed.</p></div>;
  if (currentStatus === "expired") return <div className="rounded-2xl bg-surface p-5 text-muted"><p className="font-extrabold text-ink">Verification checkmark expired</p><p className="mt-2 text-sm leading-6">The previous six-month verification period has ended. Start a new separate review payment to be considered again.</p></div>;
  if (currentStatus === "paid" || currentStatus === "pending_review") return <div className="rounded-2xl bg-amber-50 p-5 text-warning"><p className="font-extrabold">Review payment received</p><p className="mt-2 text-sm leading-6">Sella Team will review your store separately from your plan subscription. The blue checkmark appears only after approval.</p></div>;
  if (result) return <div className="rounded-2xl bg-kola-light p-5 text-sm"><p className="font-extrabold text-kola">Payment account ready</p><p className="mt-2 text-xs leading-5 text-muted">Transfer exactly {formatNaira(result.amount)}. This account expires in {countdown}.</p>{!expired && <div className="mt-4 space-y-2 rounded-xl bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted">Bank</p><p className="font-extrabold">{result.bankName || "Payment account"}</p><p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">Account number</p><button type="button" onClick={() => copy(result.accountNumber)} className="flex w-full items-center justify-between gap-2 text-left text-lg font-extrabold text-kola"><span>{result.accountNumber}</span><Copy size={16} /></button>{result.accountName && <p className="text-xs text-muted">Account name: {result.accountName}</p>}<p className="mt-2 text-[11px] text-muted">Reference: {result.reference}</p></div>}{expired && <p className="mt-3 text-xs font-bold text-danger">This payment account expired. Start a new request.</p>}{message && <p className="mt-3 text-xs font-bold text-kola">{message}</p>}</div>;

  return <div><div className="mb-3 grid gap-2"><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${paymentMethod === "wallet" ? "border-kola bg-kola-light" : "border-line bg-white"}`}><input type="radio" name="verification-payment" value="wallet" checked={paymentMethod === "wallet"} onChange={() => setPaymentMethod("wallet")} className="mt-1" /><span><span className="flex items-center gap-2 text-sm font-bold"><WalletCards size={16} />Pay from Sella balance</span><span className="mt-1 block text-xs text-muted">Available: {formatNaira(balance)}</span></span></label><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${paymentMethod === "transfer" ? "border-kola bg-kola-light" : "border-line bg-white"}`}><input type="radio" name="verification-payment" value="transfer" checked={paymentMethod === "transfer"} onChange={() => setPaymentMethod("transfer")} className="mt-1" /><span><span className="block text-sm font-bold">Bank transfer</span><span className="mt-1 block text-xs text-muted">Payment account active for 30 minutes.</span></span></label></div><button type="button" className="btn-primary w-full" onClick={submit} disabled={busy || (paymentMethod === "wallet" && Number(balance) < Number(price))}>{busy ? "Processing…" : "Pay for six-month review"}</button>{message && <p className="mt-2 text-xs font-bold text-danger">{message}</p>}</div>;
}
