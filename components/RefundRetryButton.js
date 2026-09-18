"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefundRetryButton({ refundId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function retry() {
    setBusy(true); setError("");
    const response = await fetch("/api/refunds/retry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refundId }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "Refund could not be retried.");
    router.refresh();
  }
  return <div><button type="button" className="btn-primary px-3 py-2 text-xs" onClick={retry} disabled={busy}>{busy ? "Checking wallet…" : "Retry from wallet"}</button>{error && <p className="mt-2 text-xs text-danger">{error}</p>}</div>;
}