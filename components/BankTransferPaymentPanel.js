"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import { formatNaira } from "@/lib/utils";

function countdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function BankTransferPaymentPanel({ orderId, orderCode, account, paymentTotal, orderTotal, paymentExpiresAt, onPaid }) {
  const [now, setNow] = useState(() => Date.now());
  const [checking, setChecking] = useState(false);
  const [expired, setExpired] = useState(false);
  const [paid, setPaid] = useState(false);
  const [message, setMessage] = useState("");
  const expiry = paymentExpiresAt ? new Date(paymentExpiresAt).getTime() : null;
  const remaining = expiry ? Math.max(0, expiry - now) : null;
  const exactAmount = Number(paymentTotal || orderTotal || 0);
  const expiredText = useMemo(() => "This 30-minute payment window has expired. Your items have been restocked. Check out again to create a new payment order.", []);

  useEffect(() => {
    if (!expiry || paid || expired) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiry, paid, expired]);

  useEffect(() => {
    if (expiry && remaining === 0 && !paid && !expired) {
      setExpired(true);
      fetch("/api/orders/payment-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, action: "expire" }) }).catch(() => {});
    }
  }, [expiry, remaining, paid, expired, orderId]);

  async function checkPayment() {
    setChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/orders/payment-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) });
      const data = await response.json().catch(() => ({}));
      if (data.expired) {
        setExpired(true);
        setMessage("");
      } else if (data.paid) {
        setPaid(true);
        try { window.localStorage.removeItem("sella-cart"); window.dispatchEvent(new Event("sella-cart-updated")); } catch {}
        setMessage("Payment confirmed. The seller can now fulfil your order.");
        onPaid?.();
      } else if (!response.ok) {
        setMessage(data.error || "We could not check this payment yet.");
      } else {
        setMessage(data.message || "Payment has not arrived yet. If you have just transferred, wait a moment and check again.");
      }
    } catch {
      setMessage("We could not check this payment right now. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  if (paid) return <div className="mt-4 rounded-2xl bg-kola-light p-5"><h2 className="font-semibold text-kola">Payment confirmed</h2><p className="mt-2 text-sm text-muted">{message}</p></div>;
  if (expired) return <div className="mt-4 rounded-2xl border border-danger/30 bg-red-50 p-5"><h2 className="font-semibold text-danger">Payment window expired</h2><p className="mt-2 text-sm leading-6 text-danger">{expiredText}</p><Link href="/checkout" className="btn-primary mt-4 inline-flex">Check out again</Link></div>;

  return <div className="mt-4 rounded-2xl border border-mango bg-[#FFF8E7] p-5">
    <div className="flex items-start gap-3"><Clock3 size={20} className="mt-0.5 shrink-0 text-kola" /><div><h2 className="font-semibold">Complete your bank transfer</h2>{remaining !== null && <p className="mt-1 text-sm font-bold text-kola">Time remaining: {countdown(remaining)}</p>}</div></div>
    <p className="mt-4 text-sm leading-6">Send exactly <strong>{formatNaira(exactAmount)}</strong> to <strong>{account?.bank || "the assigned bank"}</strong> account <strong>{account?.number}</strong>.</p>
    {account?.name && <p className="mt-1 text-sm text-muted">Account name: {account.name}</p>}
    <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs font-semibold leading-5 text-danger">Send the exact amount shown below. If you send a different amount, it may not be matched to your order automatically.</p>
    <button type="button" onClick={checkPayment} disabled={checking} className="btn-primary mt-4 inline-flex items-center gap-2">{checking ? "Checking your payment..." : <><RefreshCw size={16} />Transfer done</>}</button>
    {message && <p className="mt-3 text-sm text-muted">{message}</p>}
    <p className="mt-3 text-xs text-muted">Order #{orderCode}. Sella only marks this paid after TransactPay confirms the money arrived.</p>
  </div>;
}
