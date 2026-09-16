"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, WalletCards } from "lucide-react";
import { formatNaira } from "@/lib/utils";

export default function SubscriptionForm({ storeId, plan, amount, balance = 0, actionLabel = "Choose plan & pay", isCurrent = false, isDowngrade = false }) {
  const planNames = { starter: "Starter", basic: "Basic", plus: "Plus", premium: "Premium", quarterly: "Basic", biannual: "Plus", yearly: "Premium" };
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(Number(balance) >= Number(amount) ? "wallet" : "transfer");
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!result?.paymentAccountExpiresAt) return undefined;
    const update = () => setSecondsLeft(Math.max(0, Math.floor((new Date(result.paymentAccountExpiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [result?.paymentAccountExpiresAt]);

  async function submit() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId, plan, amount, paidWith: paymentMethod }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to start plan payment.");
    if (paymentMethod === "wallet") {
      setMessage("Plan activated from your Sella balance.");
      window.setTimeout(() => window.location.reload(), 900);
      return;
    }
    setResult(data);
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied.");
    } catch {
      setMessage("Copy failed — press and hold the account number to copy it.");
    }
  }

  const expired = secondsLeft !== null && secondsLeft <= 0;
  const countdown = secondsLeft === null ? "30 minutes" : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  if (isCurrent) return <div className="rounded-2xl bg-kola-light p-4 text-sm font-extrabold text-kola"><CheckCircle2 className="mr-2 inline" size={17} />Current plan</div>;
  if (isDowngrade) return <div className="rounded-2xl border border-line bg-surface p-4 text-sm font-extrabold text-muted">Downgrade</div>;
  if (result) return <div className="rounded-2xl bg-kola-light p-4 text-sm"><div className="flex items-center gap-2 font-extrabold text-kola"><CheckCircle2 size={17} />Payment account ready</div><p className="mt-2 text-xs leading-5 text-muted">Transfer exactly {formatNaira(result.amount)}. Your {planNames[result.plan] || result.plan} plan activates automatically after payment confirmation.</p><div className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${expired ? "bg-red-50 text-danger" : "bg-white text-kola"}`}>{expired ? "This payment account has expired. Start again to create a new one." : `Account active for ${countdown}. Pay before the 30-minute timer ends.`}</div>{!expired && <div className="mt-4 space-y-2 rounded-xl bg-white p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted">Bank</p><p className="font-extrabold">{result.bankName || "Payment account"}</p><p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">Account number</p><button type="button" onClick={() => copy(result.accountNumber)} className="flex w-full items-center justify-between gap-2 text-left text-lg font-extrabold text-kola"><span>{result.accountNumber}</span><Copy size={16} /></button>{result.accountName && <p className="text-xs text-muted">Account name: {result.accountName}</p>}<p className="mt-2 text-[11px] text-muted">Reference: {result.reference}</p></div>}{message && <p className="mt-2 text-xs font-bold text-kola">{message}</p>}<p className="mt-3 text-[11px] leading-5 text-muted">Do not reuse this account for another plan. Payments to an expired account are not accepted for this plan request.</p></div>;

  return <div><div className="mb-3 grid gap-2"><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${paymentMethod === "wallet" ? "border-kola bg-kola-light" : "border-line bg-white"}`}><input type="radio" name={`payment-${plan}`} value="wallet" checked={paymentMethod === "wallet"} onChange={() => setPaymentMethod("wallet")} className="mt-1" /><span><span className="flex items-center gap-2 text-sm font-bold"><WalletCards size={16} />Pay from Sella balance</span><span className="mt-1 block text-xs text-muted">Available: {formatNaira(balance)} · Use your seller balance.</span></span></label><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${paymentMethod === "transfer" ? "border-kola bg-kola-light" : "border-line bg-white"}`}><input type="radio" name={`payment-${plan}`} value="transfer" checked={paymentMethod === "transfer"} onChange={() => setPaymentMethod("transfer")} className="mt-1" /><span><span className="block text-sm font-bold">Bank transfer</span><span className="mt-1 block text-xs text-muted">Get a one-time account active for 30 minutes.</span></span></label></div><button type="button" className="btn-primary w-full" onClick={submit} disabled={busy || (paymentMethod === "wallet" && Number(balance) < Number(amount))}>{busy ? "Processing…" : actionLabel}</button>{message && <p className="mt-2 text-xs text-danger">{message}</p>}</div>;
}
