"use client";
import { useState } from "react";
export default function UnfollowStoreButton({ storeId }) { const [busy, setBusy] = useState(false); async function unfollow() { setBusy(true); await fetch("/api/buyer/follow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId, follow: false }) }); window.location.reload(); } return <button type="button" onClick={unfollow} disabled={busy} className="text-xs font-semibold text-red-700 hover:underline">{busy ? "Removing…" : "Unfollow"}</button>; }
