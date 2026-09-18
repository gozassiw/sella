"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const labels = { pending: "Pending", processing: "Order packed", shipped: "Out for delivery", delivered: "Delivered completed", cancelled: "Cancelled" };
const availableStatuses = {
  pending: ["pending", "processing"],
  processing: ["pending", "processing", "shipped"],
  shipped: ["shipped", "delivered"],
  delivered: ["delivered"],
  cancelled: [],
};

export default function OrderStatusForm({ order }) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function update(value) {
    const previous = status;
    setStatus(value);
    setSaving(true);
    setError("");
    const response = await fetch("/api/orders/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id, status: value }) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setStatus(previous);
      setError(data.error || "Unable to update");
      return;
    }
    router.refresh();
  }

  function cancelOrder() {
    if (window.confirm("Cancel order #" + order.order_code + "? This cannot be undone.")) update("cancelled");
  }

  const options = availableStatuses[status] || [status];
  return <div className="flex flex-col items-end gap-2">
    {status === "cancelled" ? <span className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-danger">Cancelled</span> : <select aria-label={"Update order " + order.order_code + " status"} value={status} disabled={saving || status === "delivered"} onChange={(event) => update(event.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs">{options.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select>}
    {!['delivered', 'cancelled'].includes(status) && <button type="button" disabled={saving} onClick={cancelOrder} className="text-[11px] font-bold text-danger underline underline-offset-4 disabled:opacity-50">Cancel order</button>}
    {status === "shipped" && <span className="max-w-[220px] text-right text-[10px] text-muted">This order can now only be marked delivered or cancelled.</span>}
    {status === "delivered" && <span className="max-w-[220px] text-right text-[10px] text-muted">Delivered orders cannot be moved backward.</span>}
    {error && <span className="max-w-[240px] text-right text-[10px] text-danger">{error}</span>}
  </div>;
}
