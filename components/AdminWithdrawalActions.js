"use client";

import AdminActionForm from "@/components/AdminActionForm";
import WithdrawalReceiptForm from "@/components/WithdrawalReceiptForm";

export default function AdminWithdrawalActions({ item }) {
  const displayStatus = item.status === "sent" ? "paid" : item.status;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${displayStatus === "paid" ? "text-success bg-green-50" : displayStatus === "rejected" ? "text-danger bg-red-50" : "text-warning bg-amber-50"}`}>{displayStatus || "pending"}</span>
      {item.status === "pending" && <>
        <AdminActionForm action="withdrawal_status" field="withdrawalId" value={item.id} nextValue="processing" label="Review payout" />
        <AdminActionForm action="withdrawal_status" field="withdrawalId" value={item.id} nextValue="rejected" label="Cancel" />
      </>}
      {item.status === "processing" && <>
        {!item.receipt_path && <WithdrawalReceiptForm withdrawalId={item.id} />}
        {item.receipt_path ? <AdminActionForm action="withdrawal_status" field="withdrawalId" value={item.id} nextValue="paid" label="Payout completed" /> : <span className="max-w-[210px] text-right text-[11px] font-semibold text-warning">Upload payment reference before completing payout</span>}
        <AdminActionForm action="withdrawal_status" field="withdrawalId" value={item.id} nextValue="rejected" label="Cancel" />
      </>}
      {(item.status === "paid" || item.status === "sent") && (item.receipt_path ? <span className="rounded-full bg-kola-light px-2.5 py-1 text-[10px] font-extrabold text-kola">Receipt uploaded</span> : <WithdrawalReceiptForm withdrawalId={item.id} />)}
    </div>
  );
}
