"use client";

import { useState } from "react";

function localDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

export default function LaunchSettingsForm({ initialValue = {} }) {
  const [enabled, setEnabled] = useState(initialValue.enabled === true);
  const [launchAt, setLaunchAt] = useState(localDateTimeValue(initialValue.launch_at));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "launch_settings", enabled, launchAt: launchAt ? new Date(launchAt).toISOString() : null }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? "Launch settings saved" : data.error || "Could not save launch settings");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="flex items-center gap-3 text-sm font-bold text-ink">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-kola" />
        Keep the public website in the waiting room
      </label>
      <div>
        <label className="label" htmlFor="launch-at">Launch date and time</label>
        <input id="launch-at" className="input max-w-xs" type="datetime-local" value={launchAt} onChange={(event) => setLaunchAt(event.target.value)} />
        <p className="hint">Leave blank to show “Launch date to be announced”. Your local time is saved as an exact timestamp.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save launch settings"}</button>
        {message && <span className="text-sm text-muted">{message}</span>}
      </div>
    </form>
  );
}
