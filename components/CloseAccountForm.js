"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseAccountForm({ role = "account" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  const reasons = [
    "I no longer need Sella",
    "Sella is not right for me or my business",
    "I had a problem using Sella",
  ];

  async function closeAccount() {
    if (!reason) return setError("Please choose a reason first.");
    const confirmed = window.confirm("Permanently close this Sella account? This cannot be undone.");
    if (!confirmed) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/account/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      setError(data.error || "We could not close this account.");
      return;
    }
    router.replace(`/login?closed=${encodeURIComponent(role)}`);
    router.refresh();
  }

  return (
    <section className="app-card border border-red-200 p-5 sm:p-6">
      <p className="eyebrow text-danger">Danger zone</p>
      <h2 className="mt-2 text-base font-extrabold">Close this account</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Why are you permanently closing your account?</p>
      <div className="mt-4 space-y-2">
        {reasons.map((item) => <label key={item} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${reason === item ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" name={`close-reason-${role}`} value={item} checked={reason === item} onChange={() => { setReason(item); setError(""); }} className="h-4 w-4 accent-kola" />{item}</label>)}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button type="button" onClick={closeAccount} disabled={busy} className="btn-danger mt-5">
        {busy ? "Closing account…" : "Permanently close account"}
      </button>
    </section>
  );
}
