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

  const options = availableStatuses[status] || [status];
  return <div className="flex flex-col items-end gap-2">
    {status === "cancelled" ? <span className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-danger">Cancelled</span> : <select aria-label={"Update order " + order.order_code + " status"} value={status} disabled={saving || status === "delivered"} onChange={(event) => update(event.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs">{options.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select>}
    {status === "shipped" && <span className="max-w-[220px] text-right text-[10px] text-muted">This order is out for delivery and can only be marked delivered.</span>}
    {status === "delivered" && <span className="max-w-[220px] text-right text-[10px] text-muted">Delivered orders cannot be moved backward.</span>}
    {error && <span className="max-w-[240px] text-right text-[10px] text-danger">{error}</span>}
  </div>;
}
