"use client";

import { useState } from "react";

export default function WithdrawalReceiptForm({ withdrawalId }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.receipt.files?.[0];
    if (!file) return setMessage("Choose a receipt first.");
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.set("withdrawalId", withdrawalId);
    body.set("receipt", file);
    const response = await fetch("/api/admin/withdrawals/receipt", { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Receipt upload failed.");
    setMessage("Receipt uploaded");
    form.reset();
    window.location.reload();
  }

  return <form onSubmit={submit} className="flex flex-wrap items-center gap-2"><input name="receipt" type="file" accept="image/*,.pdf" className="block max-w-[210px] text-[11px] text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-kola-light file:px-2.5 file:py-1.5 file:text-[11px] file:font-bold file:text-kola" required /><button className="btn-secondary px-3 py-2 text-xs" disabled={busy}>{busy ? "Uploading…" : "Upload payment reference"}</button>{message && <span className="text-[11px] text-muted">{message}</span>}</form>;
}
