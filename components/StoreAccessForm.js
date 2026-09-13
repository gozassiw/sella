"use client";

import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StoreAccessForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 8) return setError("Enter the 8-character store ID from the seller.");
    setBusy(true);
    setError("");
    const response = await fetch("/api/buyer/store-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: clean }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "That store ID could not be found.");
    router.push(`/s/${data.slug}`);
  }

  return (
    <form id="store-access" onSubmit={submit} className="app-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-kola-light text-kola"><KeyRound size={18} /></span>
        <div>
          <h2 className="text-base font-extrabold">Open a store</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Enter the unique 8-character store ID shared by the seller. Sella will open that store directly.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input className="input flex-1 uppercase tracking-[.16em]" value={code} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 8))} placeholder="Example: A1B2C3D4" aria-label="Store ID" />
        <button className="btn-primary shrink-0" disabled={busy}>{busy ? "Opening…" : "Open store"} <ArrowRight size={16} /></button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}
