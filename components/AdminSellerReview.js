"use client";

import { useState } from "react";
import { ExternalLink, Eye, X } from "lucide-react";

function Detail({ label, value }) {
  return <div className="rounded-2xl bg-surface p-3"><p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "Not submitted"}</p></div>;
}

export default function AdminSellerReview({ store }) {
  const [open, setOpen] = useState(false);
  const payout = Array.isArray(store.payout_accounts) ? store.payout_accounts : [];

  return <>
    <button type="button" onClick={() => setOpen(true)} className="text-left text-sm font-extrabold text-kola underline decoration-kola/30 underline-offset-4 hover:decoration-kola focus:outline-none focus:ring-2 focus:ring-kola/30">{store.name}</button>
    {open && <div className="fixed inset-0 z-[80] overflow-y-auto bg-ink/40 p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby={`seller-review-${store.id}`}>
      <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-5 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div><p className="eyebrow text-kola">Seller verification submission</p><h2 id={`seller-review-${store.id}`} className="mt-2 text-2xl font-extrabold">{store.name}</h2><p className="mt-1 text-sm text-muted">Review all submitted information before making a decision.</p></div>
          <button type="button" aria-label="Close seller details" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-muted"><X size={19} /></button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Detail label="Store link" value={`/${store.slug}`} />
          <Detail label="Category" value={store.category} />
          <Detail label="Seller email" value={store.seller_email} />
          <Detail label="Call number" value={store.phone} />
          <Detail label="WhatsApp number" value={store.whatsapp} />
          <Detail label="Legal / full name" value={store.legal_name} />
          <Detail label="Store address or residency area" value={store.address} />
          <Detail label="NIN" value={store.nin} />
          <Detail label="NIN status" value={store.nin_status} />
          <Detail label="CAC number" value={store.cac_number} />
          <Detail label="Submitted" value={store.onboarding_submitted_at ? new Date(store.onboarding_submitted_at).toLocaleString() : "Not submitted"} />
          <Detail label="Store status" value={store.approval_status || "pending"} />
        </div>
        <div className="mt-3 rounded-2xl bg-surface p-4"><p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Store description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{store.description || "Not submitted"}</p></div>
        <div className="mt-3 rounded-2xl bg-surface p-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">CAC upload</p>{store.cac_file_url && <a href={store.cac_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-kola underline">Open file <ExternalLink size={13} /></a>}</div><p className="mt-2 text-sm">{store.cac_file_url ? "A CAC document was submitted." : "Not submitted"}</p></div>
        <div className="mt-3 rounded-2xl bg-surface p-4"><p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Payout details</p>{payout.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{payout.map((account, index) => <div key={`${account.account_number || "account"}-${index}`} className="rounded-2xl border border-line bg-white p-3 text-sm leading-6"><strong>{account.bank_name || "Bank not submitted"}</strong><br />Account name: {account.account_name || "Not submitted"}<br />Account number: {account.account_number || "Not submitted"}<br /><span className="text-xs text-muted">{account.verified ? "Verified" : "Not verified"}</span></div>)}</div> : <p className="mt-2 text-sm">No payout account submitted.</p>}</div>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5"><p className="flex items-center gap-2 text-xs text-muted"><Eye size={15} />Close this view to approve or reject.</p><button type="button" onClick={() => setOpen(false)} className="btn-secondary">Close review</button></div>
      </div>
    </div>}
  </>;
}
