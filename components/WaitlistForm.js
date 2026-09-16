"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function countdownParts(launchAt) {
  if (!launchAt) return null;
  const remaining = Math.max(0, new Date(launchAt).getTime() - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    complete: remaining <= 0,
  };
}

function Countdown({ launchAt }) {
  const [parts, setParts] = useState(() => countdownParts(launchAt));
  useEffect(() => {
    if (!launchAt) return undefined;
    const timer = window.setInterval(() => setParts(countdownParts(launchAt)), 1000);
    return () => window.clearInterval(timer);
  }, [launchAt]);

  if (!launchAt) return <p className="mt-5 text-sm font-bold text-kola">Launch date to be announced</p>;
  if (parts?.complete) return <p className="mt-5 text-sm font-bold text-kola">Sella is launching now.</p>;

  return (
    <div className="mt-5 grid grid-cols-4 gap-2" aria-label="Countdown to Sella launch">
      {[[parts?.days, "days"], [parts?.hours, "hours"], [parts?.minutes, "mins"], [parts?.seconds, "secs"]].map(([value, label]) => (
        <div key={label} className="rounded-2xl bg-kola-light px-2 py-3 text-center text-kola">
          <strong className="block text-xl leading-none sm:text-2xl">{String(value ?? 0).padStart(2, "0")}</strong>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function WaitlistForm({ launchAt }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const launchLabel = useMemo(() => launchAt ? new Date(launchAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : null, [launchAt]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), whatsapp: whatsapp.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "We could not save your details right now. Please try again.");
        return;
      }
      setJoined(true);
    } catch {
      setError("We could not save your details right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (joined) {
    return (
      <div className="mt-7 rounded-2xl bg-kola-light p-5 text-kola">
        <CheckCircle2 size={25} aria-hidden="true" />
        <p className="mt-3 text-base font-extrabold">You&apos;re on the list.</p>
        <p className="mt-2 text-sm leading-6">We&apos;ll use the contact details you shared to let you know when Sella launches.</p>
        <Countdown launchAt={launchAt} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <div>
        <label className="label" htmlFor="waitlist-name">Full name</label>
        <input id="waitlist-name" className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={120} required />
      </div>
      <div>
        <label className="label" htmlFor="waitlist-email">Email address</label>
        <input id="waitlist-email" className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={320} required />
      </div>
      <div>
        <label className="label" htmlFor="waitlist-whatsapp">WhatsApp number</label>
        <input id="waitlist-whatsapp" className="input" type="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} autoComplete="tel" inputMode="tel" maxLength={40} placeholder="e.g. 0803 123 4567" required />
      </div>
      {error && <p className="text-sm font-bold text-danger" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Joining the list…" : "Join the launch list"}</button>
      <div className="border-t border-line pt-4">
        <p className="text-xs leading-5 text-muted">{launchLabel ? `Expected launch: ${launchLabel}` : "We will publish the launch date here when it is confirmed."}</p>
        <Countdown launchAt={launchAt} />
      </div>
    </form>
  );
}
