import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";

function statusStyle(status) {
  if (status === "paid" || status === "sent") return "bg-green-50 text-success";
  if (status === "rejected") return "bg-red-50 text-danger";
  return "bg-amber-50 text-warning";
}

export default async function WithdrawalDetailPage({ params }) {
  const { supabase, store } = await getMyStore();
  const { data: withdrawal, error } = await supabase.from("withdrawals").select("id,amount,fee,payout_amount,status,bank_name,account_number,account_name,created_at,processed_at,note,receipt_path,receipt_name,receipt_uploaded_at").eq("id", params.id).eq("store_id", store.id).maybeSingle();
  if (error || !withdrawal) notFound();

  let receiptUrl = null;
  if (withdrawal.receipt_path) {
    const { data } = await supabase.storage.from("withdrawal-receipts").createSignedUrl(withdrawal.receipt_path, 3600);
    receiptUrl = data?.signedUrl || null;
  }

  const statusLabel = withdrawal.status === "sent" || withdrawal.status === "paid" ? "payout completed" : withdrawal.status === "processing" ? "payment reference pending" : withdrawal.status;
  return <div className="mx-auto max-w-2xl space-y-6"><Link href="/dashboard/wallet" className="text-sm font-bold text-kola">← Back to wallet</Link><div><p className="eyebrow text-kola">Withdrawal activity</p><h1 className="display mt-3 text-3xl">Withdrawal request</h1><p className="mt-2 text-sm text-muted">Submitted {new Date(withdrawal.created_at).toLocaleString()}</p></div><section className="app-card space-y-5 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-lg font-extrabold">{formatNaira(withdrawal.amount)} requested</p><span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase ${statusStyle(withdrawal.status)}`}>{statusLabel}</span></div><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted">Payout</p><p className="mt-1 font-extrabold">{formatNaira(withdrawal.payout_amount ?? Number(withdrawal.amount || 0) - Number(withdrawal.fee || 0))}</p></div><div><p className="text-xs text-muted">Sella fee</p><p className="mt-1 font-extrabold">{formatNaira(withdrawal.fee)}</p></div><div><p className="text-xs text-muted">Processed</p><p className="mt-1 text-sm font-bold">{withdrawal.processed_at ? new Date(withdrawal.processed_at).toLocaleString() : "Awaiting action"}</p></div></div><div className="rounded-2xl bg-surface p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">Bank destination</p><p className="mt-2 text-sm font-extrabold">{withdrawal.bank_name}</p><p className="mt-1 text-sm text-muted">{withdrawal.account_number} · {withdrawal.account_name || "Account name unavailable"}</p></div>{withdrawal.note && <p className="rounded-2xl bg-surface p-4 text-sm leading-6 text-muted">{withdrawal.note}</p>}{receiptUrl ? <div className="rounded-2xl border border-kola/20 bg-kola-light p-4"><p className="text-sm font-extrabold text-kola">Payment reference</p><p className="mt-1 text-xs text-muted">Uploaded {withdrawal.receipt_uploaded_at ? new Date(withdrawal.receipt_uploaded_at).toLocaleString() : "by Sella Team"}.</p><a href={receiptUrl} target="_blank" rel="noreferrer" className="btn-primary mt-3 inline-flex">Open payment reference{withdrawal.receipt_name ? ` · ${withdrawal.receipt_name}` : ""}</a></div> : <p className="text-sm text-muted">Payment reference will appear here when the payout is completed.</p>}</section></div>;
}
