"use client";
import { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";
import { formatNaira } from "@/lib/utils";

export default function SubscriptionForm({ storeId, plan, amount }) {
  const planNames = { basic: "Basic", plus: "Plus", premium: "Premium", quarterly: "Basic", biannual: "Plus", yearly: "Premium" };
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId, plan, amount, paidWith: "transfer" }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to start plan payment.");
    setResult(data);
  }
  async function copy(value) { try { await navigator.clipboard.writeText(value); setMessage("Copied."); } catch { setMessage("Copy failed — press and hold the account number to copy it."); } }
  if (result) return <div className="rounded-2xl bg-kola-light p-4 text-sm"><div className="flex items-center gap-2 font-extrabold text-kola"><CheckCircle2 size={17} />Payment account ready</div><p className="mt-2 text-xs leading-5 text-muted">Transfer exactly {formatNaira(result.amount)}. Your {planNames[result.plan] || result.plan} plan activates automatically after payment confirmation.</p><div className="mt-4 space-y-2 rounded-xl bg-white p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted">Bank</p><p className="font-extrabold">{result.bankName || "Payment account"}</p><p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">Account number</p><button type="button" onClick={() => copy(result.accountNumber)} className="flex w-full items-center justify-between gap-2 text-left text-lg font-extrabold text-kola"><span>{result.accountNumber}</span><Copy size={16} /></button>{result.accountName && <p className="text-xs text-muted">Account name: {result.accountName}</p>}<p className="mt-2 text-[11px] text-muted">Reference: {result.reference}</p></div>{message && <p className="mt-2 text-xs font-bold text-kola">{message}</p>}<p className="mt-3 text-[11px] leading-5 text-muted">Do not reuse this account for another plan. If the payment does not reflect, keep the transfer receipt and contact Sella support.</p></div>;
  return <div><button type="button" className="btn-primary w-full" onClick={submit} disabled={busy}>{busy ? "Creating payment account…" : "Choose plan & pay"}</button>{message && <p className="mt-2 text-xs text-danger">{message}</p>}</div>;
}
