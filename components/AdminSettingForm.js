"use client";

import { useState } from "react";

export default function AdminSettingForm({ initialValue, initialRate, settingKey = "commission_rate", label = "Save", valueField = "rate", inputLabel = "Rate %", min = 0, max = 100, step = 0.01 }) {
  const [value, setValue] = useState(initialValue ?? initialRate ?? 0);
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setting", key: settingKey, value: { [valueField]: Number(value) } }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Saved" : data.error || "Save failed");
  }
  return <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3"><div><label className="label">{inputLabel}</label><input className="input w-32" type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={(event) => setValue(event.target.value)} /></div><button className="btn-primary">{label}</button>{message && <span className="text-sm text-muted">{message}</span>}</form>;
}
