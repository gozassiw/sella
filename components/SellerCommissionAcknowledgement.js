"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function SellerCommissionAcknowledgement() {
  const [open, setOpen] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function continueSetup() {
    if (!accepted || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/seller/commission-acknowledgement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save your acknowledgement.");
      setOpen(false);
      window.location.reload();
    } catch (acknowledgementError) {
      setError(acknowledgementError.message);
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/40 px-4" role="dialog" aria-modal="true" aria-labelledby="commission-title">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-kola">Your store is approved</p>
            <h2 id="commission-title" className="mt-2 text-2xl font-extrabold">Before you continue</h2>
          </div>
        </div>
        <div className="mt-5 rounded-2xl bg-kola-light p-4 text-sm leading-6 text-kola">
          <p><strong>Sella charges a 3% platform commission on each completed order.</strong> This is deducted from the order amount before your Sella balance is credited.</p>
          <div className="mt-3 border-t border-kola/15 pt-3 font-semibold">Example: on a ₦10,000 order, Sella takes ₦300 and you receive ₦9,700.</div>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm leading-6">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-kola" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>I understand and agree to the 3% platform commission.</span>
        </label>
        {error && <p className="error mt-4">{error}</p>}
        <button type="button" className="btn-primary mt-5 w-full" disabled={!accepted || saving} onClick={continueSetup}>{saving ? "Saving…" : "Continue setup"}</button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted"><CheckCircle2 size={14} className="text-kola" />You only need to accept this once.</p>
      </div>
    </div>
  );
}
