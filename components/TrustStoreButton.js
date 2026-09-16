"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function TrustStoreButton({ storeId, initialTrusted = false }) {
  const [trusted, setTrusted] = useState(initialTrusted);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [notice, setNotice] = useState(null);
  const [noticeError, setNoticeError] = useState("");
  const [toast, setToast] = useState("");
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const previous = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) { closeConfirmation(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll("button, input, [href]");
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => dialogRef.current?.querySelector("input, button")?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKeyDown); if (previous && previous.focus) previous.focus(); };
  }, [modalOpen, busy]);

  function closeConfirmation(force = false) {
    if (busy && !force) return;
    setModalOpen(false); setNotice(null); setNoticeError(""); setAcknowledged(false);
  }
  async function openConfirmation() {
    setMessage(""); setNoticeError(""); setAcknowledged(false); setNotice(null); setModalOpen(true); setBusy(true);
    try {
      const response = await fetch(`/api/buyer/trust-notice?storeId=${encodeURIComponent(storeId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setModalOpen(false); return setMessage(data.error || "Unable to open Trust Store confirmation."); }
      setNotice(data);
    } catch {
      setModalOpen(false); setMessage("Unable to open Trust Store confirmation.");
    } finally { setBusy(false); }
  }
  async function removeTrust() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/buyer/follow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId, follow: false }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(data.error || "Unable to remove this store from My Trusted Stores.");
      setTrusted(false); window.dispatchEvent(new Event("sella-trust-updated"));
    } catch { setMessage("Unable to remove this store from My Trusted Stores."); }
    finally { setBusy(false); }
  }
  async function confirmTrust() {
    if (!acknowledged || !notice?.nonce) return;
    setBusy(true); setNoticeError("");
    try {
      const response = await fetch("/api/buyer/follow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId, follow: true, acknowledged: true, noticeNonce: notice.nonce, noticeVersion: notice.noticeVersion }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setNoticeError(data.error || "Unable to trust this store.");
      setTrusted(true); closeConfirmation(true); setToast("Store added to My Trusted Stores.");
      window.setTimeout(() => setToast(""), 3500); window.dispatchEvent(new Event("sella-trust-updated"));
    } catch { setNoticeError("Unable to trust this store."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="flex flex-col items-center gap-2"><button ref={triggerRef} type="button" onClick={trusted ? removeTrust : openConfirmation} disabled={busy} className={trusted ? "btn-soft" : "btn-primary"}><ShieldCheck size={16} />{busy ? "Saving…" : trusted ? "Remove from My Trusted Stores" : "Trust this store"}</button>{message && <p className="text-xs text-danger">{message}</p>}</div>
    {modalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 px-4 py-6"><div role="dialog" aria-modal="true" aria-labelledby="trust-store-heading" ref={dialogRef} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] border border-kola/15 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">{notice?.store?.logoUrl ? <img src={notice.store.logoUrl} alt={`${notice.store.name} logo`} className="h-14 w-14 rounded-2xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-kola text-xl font-extrabold text-white">{notice?.store?.name?.charAt(0)?.toUpperCase() || "S"}</span>}<div className="min-w-0"><h2 id="trust-store-heading" className="text-xl font-extrabold">Trust this store?</h2><p className="mt-1 truncate text-sm font-bold">{notice?.store?.name || "Store"}</p><p className="mt-1 text-xs text-muted">Store ID: {notice?.store?.sellerCode || "Unavailable"}</p></div></div>
      {!notice && !noticeError && <p className="mt-6 text-sm text-muted">Loading the store confirmation…</p>}
      {notice && <><p className="mt-5 whitespace-pre-line text-sm leading-6 text-ink">You’re choosing to trust this independent seller and add their store to My Trusted Stores.{"\n\n"}Please make sure you recognize the business and are comfortable purchasing from it.</p><div className="mt-4 rounded-2xl border border-kola/15 bg-kola-light p-4 text-sm leading-6 text-ink"><p className="font-extrabold">Before you continue</p><p className="mt-1">The seller is responsible for product descriptions, order fulfilment, delivery and applicable refunds. Trusting a store does not mean Sella guarantees its products or delivery.</p></div><label className="mt-5 flex cursor-pointer items-start gap-3 text-sm font-semibold leading-5"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-kola" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />I understand and choose to trust this store.</label></>}
      {noticeError && <p className="mt-4 text-sm text-danger">{noticeError}</p>}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className="btn-soft" onClick={closeConfirmation} disabled={busy}>Cancel</button><button type="button" className="btn-primary" onClick={confirmTrust} disabled={busy || !acknowledged || !notice?.nonce}>{busy ? "Saving…" : "Trust Store"}</button></div>
    </div></div>}
    {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-kola-dark px-4 py-3 text-sm font-bold text-white shadow-xl">{toast}</div>}
  </>;
}
