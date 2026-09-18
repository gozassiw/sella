"use client";
import Link from "next/link";
import { useState } from "react";
import { EVIDENCE_MAX_FILES, EVIDENCE_MAX_BYTES, REPORT_REASONS } from "@/lib/report-safety";

export default function ReportButton({ storeId, productId = null, orderId = null, type = "order", triggerLabel = "Report a problem" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(null);
  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(formElement);
      form.append("storeId", storeId);
      if (productId) form.append("productId", productId);
      if (orderId) form.append("orderId", orderId);
      form.append("type", type);
      const response = await fetch("/api/reports", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to submit report.");
      formElement.reset();
      setSubmitted({ id: data.report?.id, caseRef: data.report?.case_ref || "Saved", warning: data.warning || "" });
    } catch (error) {
      setMessage(error.message || "Unable to submit report. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return <div>
    <button type="button" onClick={() => setOpen((value) => !value)} className="text-xs font-semibold text-muted underline underline-offset-4 hover:text-kola">{open ? "Close" : triggerLabel}</button>
    {open && submitted ? <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-5" role="status"><p className="text-sm font-extrabold text-success">Report submitted successfully</p><p className="mt-2 text-sm text-ink">Case reference: <strong>{submitted.caseRef}</strong></p>{submitted.warning && <p className="mt-2 text-xs text-warning">{submitted.warning}</p>}<div className="mt-4 flex flex-wrap gap-3">{submitted.id && <Link href={`/account/reports/${submitted.id}`} className="btn-secondary px-4 py-2 text-xs">View report</Link>}<button type="button" className="btn-soft px-4 py-2 text-xs" onClick={() => { setSubmitted(null); setMessage(""); }}>Report another issue</button></div></div> : open ? <form onSubmit={submit} className="mt-3 space-y-3 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">Report to Sella</p><span className="text-[10px] text-muted">Private case</span></div>
      <select className="input" name="reason" required defaultValue=""><option value="" disabled>Choose a reason</option>{REPORT_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select>
      <textarea className="input" name="details" rows={4} maxLength={5000} placeholder="Tell us what happened. Avoid sharing passwords or payment PINs." />
      <div><label className="text-xs font-semibold text-ink">Evidence (optional)</label><input className="mt-1 block w-full text-xs" name="evidence" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple onChange={(event) => { if (event.target.files.length > EVIDENCE_MAX_FILES || Array.from(event.target.files).some((file) => file.size > EVIDENCE_MAX_BYTES) || Array.from(event.target.files).reduce((sum, file) => sum + file.size, 0) > 3 * 1024 * 1024) { event.target.value = ""; setMessage(`Choose up to ${EVIDENCE_MAX_FILES} images or PDFs, 2 MB each, 3 MB combined.`); } }} /><p className="mt-1 text-[10px] text-muted">Images or PDF, up to 3 files and 2 MB each, 3 MB combined. Evidence is not public.</p></div>
      <button className="btn-secondary" disabled={busy}>{busy ? "Submitting…" : "Submit report"}</button>
      {message && <p className="text-xs text-muted" role="status">{message}</p>}
    </form> : null}
  </div>;
}
