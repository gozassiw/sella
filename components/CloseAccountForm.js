"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseAccountForm({ role = "account" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function closeAccount() {
    const confirmed = window.confirm(
      "Permanently close this Sella account? Your personal profile, store access, follows, notifications, and chat content will be removed. Sella will retain limited order, payment, fraud, legal, and audit records for reconciliation and legal obligations. This cannot be undone."
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/account/close", { method: "POST" });
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
      <p className="mt-2 text-sm leading-6 text-muted">
        Permanently disable sign-in and remove your personal Sella profile. Limited order, payment, fraud, legal, and audit records may remain in Sella&apos;s backend where required for reconciliation and legal obligations.
      </p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button type="button" onClick={closeAccount} disabled={busy} className="btn-danger mt-5">
        {busy ? "Closing account…" : "Permanently close account"}
      </button>
    </section>
  );
}
