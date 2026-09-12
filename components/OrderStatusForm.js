"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
const labels = { pending: "Pending", processing: "Order packed", shipped: "Out for delivery", delivered: "Delivered completed", cancelled: "Cancelled" };

export default function OrderStatusForm({ order }) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function update(value) {
    const previous = status;
    setStatus(value); setSaving(true); setError("");
    const response = await fetch("/api/orders/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id, status: value }) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setStatus(previous); setError(data.error || "Unable to update"); return; }
    router.refresh();
  }
  return <div className="flex flex-col items-end gap-1"><select aria-label={`Update order ${order.order_code} status`} value={status} disabled={saving} onChange={(e) => update(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs">{statuses.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select>{error && <span className="text-[10px] text-danger">{error}</span>}</div>;
}
