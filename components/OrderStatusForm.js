"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
export default function OrderStatusForm({ order }) {
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);
  async function update(value) {
    setStatus(value); setSaving(true);
    const { error } = await createClient().from("orders").update({ status: value }).eq("id", order.id);
    setSaving(false);
    if (error) setStatus(order.status);
  }
  return <select value={status} disabled={saving} onChange={(e) => update(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs capitalize">{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>;
}
