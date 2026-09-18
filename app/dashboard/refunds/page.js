import Link from "next/link";
import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";
import RefundRetryButton from "@/components/RefundRetryButton";

export const dynamic = "force-dynamic";

export default async function SellerRefundsPage() {
  const { supabase } = await getMyStore();
  const { data: refunds, error } = await supabase.from("refund_obligations")
    .select("id,order_id,original_amount,refund_amount,available_seller_funds,outstanding_seller_contribution,cancellation_reason,status,created_at,orders(order_code,customers(name))")
    .in("status", ["pending_review", "pending_funding", "processing", "failed"]).order("created_at", { ascending: false });
  return <div className="space-y-6"><header><p className="eyebrow text-kola">Seller finance</p><h1 className="display mt-2 text-3xl">Outstanding refunds</h1><p className="mt-2 text-sm text-muted">Paid-order cancellations remain visible until the buyer’s wallet is actually credited.</p></header>
    {error ? <div className="panel text-sm text-danger">Refunds could not be loaded. Please refresh.</div> : refunds?.length ? <div className="space-y-3">{refunds.map((refund) => <article key={refund.id} className="app-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-extrabold">Order #{refund.orders?.order_code || refund.order_id.slice(0, 8)}</p><p className="mt-1 text-xs text-muted">{refund.orders?.customers?.name || "Buyer"} · {new Date(refund.created_at).toLocaleString("en-NG")}</p><p className="mt-3 text-xs leading-5 text-muted">Reason: {refund.cancellation_reason}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-warning">{refund.status}</span></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><div><p className="text-muted">Refund due</p><p className="mt-1 font-extrabold">{formatNaira(refund.refund_amount)}</p><p className="mt-2 text-muted">Available snapshot</p><p className="font-extrabold">{formatNaira(refund.available_seller_funds)}</p><p className="mt-1 text-[11px] text-muted">Funds are not reserved until retry completes.</p></div><div><p className="text-muted">Seller contribution outstanding</p><p className="mt-1 font-extrabold">{formatNaira(refund.outstanding_seller_contribution)}</p></div><div><p className="text-muted">Actions</p><div className="mt-2 flex flex-wrap gap-2"><Link href={`/dashboard/orders?order=${refund.order_id}`} className="btn-soft px-3 py-2 text-xs">View refund</Link>{refund.status === "pending_funding" && <RefundRetryButton refundId={refund.id} />}<Link href="/dashboard/messages" className="btn-soft px-3 py-2 text-xs">Contact support</Link></div></div></div></article>)}</div> : <div className="app-card p-8 text-center"><p className="font-extrabold">No outstanding refunds</p><p className="mt-2 text-sm text-muted">Paid-order refund obligations will appear here if a cancellation needs follow-up.</p></div>}
  </div>;
}