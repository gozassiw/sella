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
    {modalOpen && <div className="fixed inset-0 z-50 grid place-items-end bg-ink/55 px-3 py-3 backdrop-blur-[2px] sm:place-items-center sm:px-4 sm:py-6"><div role="dialog" aria-modal="true" aria-labelledby="trust-store-heading" ref={dialogRef} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[26px] border border-kola/10 bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-center gap-3 border-b border-line pb-4">{notice?.store?.logoUrl ? <img src={notice.store.logoUrl} alt={`${notice.store.name} logo`} className="h-14 w-14 shrink-0 rounded-2xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-kola text-xl font-extrabold text-white">{notice?.store?.name?.charAt(0)?.toUpperCase() || "S"}</span>}<div className="min-w-0 flex-1"><h2 id="trust-store-heading" className="text-xl font-extrabold leading-tight text-ink">Trust this store?</h2><p className="mt-1 truncate text-sm font-extrabold text-ink">{notice?.store?.name || "Store"}</p><p className="mt-0.5 text-xs font-medium text-muted">Store ID: {notice?.store?.sellerCode || "Unavailable"}</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-kola-light text-kola"><ShieldCheck size={18} /></span></div>
      {!notice && !noticeError && <div className="py-8 text-center"><p className="text-sm font-semibold text-muted">Loading store details…</p></div>}
      {notice && <div className="pt-4"><div><p className="text-base font-extrabold text-ink">Add this seller to My Trusted Stores</p><p className="mt-1.5 text-sm leading-6 text-muted">Only continue if you recognize this seller and feel comfortable buying from them.</p></div><div className="mt-4 rounded-2xl border border-kola/15 bg-kola-light p-4"><p className="flex items-center gap-2 text-sm font-extrabold text-kola-dark"><ShieldCheck size={16} />What this means</p><p className="mt-2 text-sm leading-6 text-ink">This is an independent seller responsible for product descriptions, order fulfilment, delivery and applicable refunds. Sella provides the platform but does not guarantee products or delivery.</p></div><label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-5 transition ${acknowledged ? "border-kola bg-kola-light/60" : "border-line bg-white"}`}><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-kola" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I recognize this seller and choose to trust this store.</span></label></div>}
      {noticeError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-danger">{noticeError}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" className="btn-soft w-full" onClick={closeConfirmation} disabled={busy}>Cancel</button><button type="button" className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-45" onClick={confirmTrust} disabled={busy || !acknowledged || !notice?.nonce}>{busy ? "Saving…" : "Trust Store"}</button></div>
    </div></div>}
    {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-kola-dark px-4 py-3 text-sm font-bold text-white shadow-xl">{toast}</div>}
  </>;
}
