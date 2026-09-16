"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Flag, MessageSquare, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { getReportReasonLabel, REPORT_STATUSES } from "@/lib/report-safety";

const statusTone = {
  Submitted: "bg-surface text-ink",
  "Under Review": "bg-blue-50 text-blue-800",
  "Awaiting Seller Response": "bg-amber-50 text-amber-800",
  Resolved: "bg-kola-light text-kola",
  Closed: "bg-surface text-muted",
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function CaseRow({ report, selected, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(report.id)} className={`w-full border-b border-line p-4 text-left transition last:border-0 hover:bg-surface ${selected ? "bg-kola-light/50" : "bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-ink">{report.case_ref || "Safety case"}</p>
          <p className="mt-1 truncate text-xs text-muted">{report.stores?.name || "Store"}{report.orders?.order_code ? ` · Order #${report.orders.order_code}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone[report.status] || "bg-surface text-muted"}`}>{report.status}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted">{getReportReasonLabel(report.report_reason || report.reason)} · {formatDate(report.created_at)}</p>
    </button>
  );
}

export default function AdminReportsPanel({ initialReports = [] }) {
  const [reports, setReports] = useState(initialReports || []);
  const [selectedId, setSelectedId] = useState(initialReports?.[0]?.id || null);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(!initialReports?.length);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [sellerVisible, setSellerVisible] = useState(true);
  const [status, setStatus] = useState("");

  const filteredReports = useMemo(() => filter === "all" ? reports : reports.filter((report) => report.status === filter), [filter, reports]);

  async function loadReports() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/reports/admin", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Reports could not be loaded.");
      const next = data.reports || [];
      setReports(next);
      setSelectedId((current) => next.some((report) => report.id === current) ? current : next[0]?.id || null);
    } catch (error) {
      setMessage(error.message || "Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(reportId) {
    if (!reportId) { setDetail(null); return; }
    setSelectedId(reportId);
    setMessage("");
    try {
      const response = await fetch(`/api/reports/${reportId}?admin=1`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Case detail could not be loaded.");
      setDetail(data);
      setStatus(data.report?.status || "");
    } catch (error) {
      setMessage(error.message || "Case detail could not be loaded.");
    }
  }

  useEffect(() => { loadReports(); }, []);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);

  async function performAction(action, actionStatus = null) {
    if (!selectedId) return;
    if (["internal_note", "seller_request", "admin_action"].includes(action) && !note.trim()) {
      setMessage("Write the note or action detail before sending.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/reports/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId: selectedId, action, status: actionStatus, body: note, sellerVisible }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Report action failed.");
      setNote("");
      setMessage(action === "status" ? "Case status updated." : "Case action recorded.");
      await loadReports();
      await loadDetail(selectedId);
    } catch (error) {
      setMessage(error.message || "Report action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow text-kola">Reports & safety</p><h2 className="display mt-1 text-2xl">Buyer-safety cases</h2><p className="mt-2 max-w-2xl text-sm text-muted">Review submitted concerns, keep internal notes private, and request seller context. A report does not promise an automatic refund or recovery of money.</p></div>
        <button type="button" onClick={loadReports} className="btn-soft inline-flex items-center gap-2 px-3 py-2 text-xs" disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(250px,340px)_1fr]">
        <div className="overflow-hidden rounded-[22px] border border-line bg-white">
          <div className="border-b border-line p-3"><label className="sr-only" htmlFor="report-status-filter">Filter cases</label><select id="report-status-filter" className="input py-2.5 text-xs" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All cases</option>{REPORT_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          {loading && <p className="p-6 text-sm text-muted">Loading cases…</p>}
          {!loading && !filteredReports.length && <p className="p-6 text-sm text-muted">No cases in this view.</p>}
          {!loading && filteredReports.map((report) => <CaseRow key={report.id} report={report} selected={report.id === selectedId} onSelect={setSelectedId} />)}
        </div>
        <div className="app-card min-w-0 p-5 sm:p-6">
          {!detail?.report ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><Flag size={26} className="text-muted" /><p className="mt-3 font-semibold">Select a case to review</p><p className="mt-1 text-sm text-muted">Case evidence and private notes appear here.</p></div> : <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-5"><div><p className="text-xs font-bold uppercase tracking-wide text-muted">{detail.report.case_ref}</p><h3 className="mt-1 text-xl font-extrabold">{detail.report.stores?.name || "Store"}</h3><p className="mt-1 text-xs text-muted">{getReportReasonLabel(detail.report.report_reason || detail.report.reason)} · Opened {formatDate(detail.report.created_at)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[detail.report.status] || "bg-surface text-muted"}`}>{detail.report.status}</span></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-muted">Report details</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{detail.report.details || "No additional details supplied."}</p></div><div className="rounded-2xl bg-surface p-4 text-xs leading-5 text-muted"><p className="font-bold text-ink">Linked context</p><p className="mt-2">Type: {detail.report.type || "—"}</p>{detail.report.orders && <p>Order: #{detail.report.orders.order_code || detail.report.orders.order_number || detail.report.order_id}</p>}<p>Updated: {formatDate(detail.report.updated_at)}</p></div></div>
            <div className="mt-5 rounded-2xl border border-line p-4"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-kola" /><p className="text-sm font-extrabold">Evidence</p></div>{detail.evidence?.length ? <ul className="mt-3 space-y-2">{detail.evidence.map((file) => <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-xs"><span className="min-w-0 truncate">{file.file_name} <span className="text-muted">({Math.ceil(file.byte_size / 1024)} KB)</span></span>{file.signed_url ? <a href={file.signed_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-bold text-kola">Open <ExternalLink size={12} /></a> : <span className="text-muted">Unavailable</span>}</li>)}</ul> : <p className="mt-2 text-xs text-muted">No evidence attached.</p>}</div>
            <div className="mt-5 border-t border-line pt-5"><label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor="case-status">Update status</label><div className="mt-2 flex flex-wrap gap-2"><select id="case-status" className="input max-w-xs py-2.5 text-xs" value={status} onChange={(event) => setStatus(event.target.value)}>{REPORT_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select><button type="button" className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs" disabled={busy || !status} onClick={() => performAction("status", status)}><RefreshCw size={14} />Save status</button></div></div>
            <div className="mt-5 border-t border-line pt-5"><label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor="case-note">Internal note or action detail</label><textarea id="case-note" className="input mt-2" rows={4} maxLength={5000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record what was checked or what Sella did. Do not include payment PINs or passwords." /><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className="btn-soft inline-flex items-center gap-2 px-3 py-2 text-xs" disabled={busy} onClick={() => performAction("internal_note")}><MessageSquare size={14} />Private note</button><button type="button" className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs" disabled={busy} onClick={() => performAction("admin_action")}><ShieldCheck size={14} />Record action</button><button type="button" className="btn-primary inline-flex items-center gap-2 px-3 py-2 text-xs" disabled={busy} onClick={() => performAction("seller_request")}><Send size={14} />Contact seller</button><label className="ml-1 inline-flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={sellerVisible} onChange={(event) => setSellerVisible(event.target.checked)} />Show status note to buyer/seller</label></div></div>
            {message && <p className="mt-4 rounded-xl bg-surface p-3 text-xs text-muted" role="status">{message}</p>}
            <div className="mt-5 border-t border-line pt-5"><p className="text-xs font-bold uppercase tracking-wide text-muted">Case timeline</p><div className="mt-3 space-y-3">{detail.events?.length ? detail.events.map((event) => <div key={event.id} className="rounded-xl bg-surface p-3"><div className="flex justify-between gap-3 text-[11px] text-muted"><span className="font-bold text-ink">{event.event_type.replaceAll("_", " ")}</span><span>{formatDate(event.created_at)}</span></div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted">{event.body || "System update"}</p></div>) : <p className="text-xs text-muted">No timeline entries yet.</p>}</div></div>
          </>}
        </div>
      </div>
    </section>
  );
}

export { AdminReportsPanel };
