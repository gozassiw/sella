"use client";

import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

const TIME_SLOTS = ["10am–12pm", "12pm–2pm", "2pm–4pm", "4pm–6pm"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function monthLabel(date) {
  return date.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

export default function DemoBookingForm() {
  const today = useMemo(() => startOfToday(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [day, setDay] = useState(() => dateKey(today));
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState(false);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const mondayOffset = (first.getDay() + 6) % 7;
    return [...Array(mondayOffset).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];
  }, [month]);

  function moveMonth(offset) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    const earliest = new Date(today.getFullYear(), today.getMonth(), 1);
    if (next >= earliest) setMonth(next);
  }

  async function submit(event) {
    event.preventDefault();
    if (!day || !slot || !name.trim() || !whatsapp.trim()) {
      setError("Choose a day and time, then enter your name and WhatsApp number.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/demo-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), whatsapp: whatsapp.trim(), requestedDay: day, timeSlot: slot }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "We could not save your demo request. Please try again.");
      return;
    }
    setBooked(true);
  }

  if (booked) return <div className="demo-confirmation"><CheckCircle2 size={34} /><p className="seller-eyebrow">Demo request received</p><h2>You&apos;re booked — we&apos;ll message you on WhatsApp to confirm.</h2><p>Keep your phone close. A member of the Sella team will follow up about your free 30-minute guided call.</p></div>;

  return <form className="demo-booking-form" onSubmit={submit}>
    <div className="demo-booking-grid">
      <div className="demo-calendar-block">
        <div className="demo-section-heading"><div><p className="seller-eyebrow">Choose a day</p><h2>Select a day</h2></div><div className="demo-month-controls"><button type="button" onClick={() => moveMonth(-1)} disabled={month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()} aria-label="Previous month"><ChevronLeft size={19} /></button><strong>{monthLabel(month)}</strong><button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={19} /></button></div></div>
        <div className="demo-weekdays">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
        <div className="demo-days">{days.map((date, index) => date ? <button type="button" key={dateKey(date)} disabled={date < today} className={day === dateKey(date) ? "is-selected" : ""} onClick={() => setDay(dateKey(date))}>{date.getDate()}</button> : <span key={`empty-${index}`} />)}</div>
      </div>
      <div className="demo-time-block"><p className="seller-eyebrow">Choose a time</p><h2>Time slot</h2><div className="demo-time-list">{TIME_SLOTS.map((value) => <button type="button" key={value} className={slot === value ? "is-selected" : ""} onClick={() => setSlot(value)}>{value}</button>)}</div><p className="demo-time-note">We&apos;ll confirm the call with you on WhatsApp.</p></div>
    </div>
    <div className="demo-details"><p className="seller-eyebrow">Your details</p><h2>Where should we reach you?</h2><div className="demo-fields"><label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" required /></label><label>WhatsApp number<input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="e.g. 0803 123 4567" inputMode="tel" autoComplete="tel" required /></label></div></div>
    {error && <p className="demo-form-error">{error}</p>}
    <button className="seller-button seller-button-primary demo-submit" disabled={busy}>{busy ? "Saving your request…" : "Schedule Event"}</button>
  </form>;
}
