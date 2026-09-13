"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function TrustStoreButton({ storeId, initialTrusted = false }) {
  const [trusted, setTrusted] = useState(initialTrusted);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function toggle() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/buyer/follow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId, follow: !trusted }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to update your trusted stores.");
    setTrusted(Boolean(data.following));
    window.dispatchEvent(new Event("sella-trust-updated"));
  }

  return <div className="flex flex-col items-center gap-2"><button type="button" onClick={toggle} disabled={busy} className={trusted ? "btn-soft" : "btn-primary"}><ShieldCheck size={16} />{busy ? "Saving…" : trusted ? "Trusted store" : "Trust this store"}</button>{message && <p className="text-xs text-danger">{message}</p>}</div>;
}
