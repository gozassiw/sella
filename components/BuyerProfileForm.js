"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuyerProfileForm({ profile, returnTo = "/account" }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [callNumber, setCallNumber] = useState(profile?.call_number || "");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || "");
  const [address, setAddress] = useState(profile?.delivery_address || "");
  const [sameAsWhatsapp, setSameAsWhatsapp] = useState(!!callNumber && callNumber === whatsapp);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function changeCallNumber(value) { setCallNumber(value); if (sameAsWhatsapp) setWhatsapp(value); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/buyer/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName, callNumber, whatsapp, deliveryAddress: address }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "Unable to save profile.");
    router.push(returnTo); router.refresh();
  }
  return <form onSubmit={submit} className="space-y-4"><div><label className="label" htmlFor="full-name">Full name</label><input id="full-name" className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="Your full name" /></div><div><label className="label" htmlFor="call-number">Call number</label><input id="call-number" className="input" value={callNumber} onChange={(event) => changeCallNumber(event.target.value)} required type="tel" placeholder="0803 123 4567" /></div><div><label className="label" htmlFor="whatsapp-number">WhatsApp number</label><input id="whatsapp-number" className="input" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} required type="tel" placeholder="0803 123 4567" disabled={sameAsWhatsapp} /><label className="mt-3 flex cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#087F5B]" checked={sameAsWhatsapp} onChange={(event) => { setSameAsWhatsapp(event.target.checked); if (event.target.checked) setWhatsapp(callNumber); }} />My call number is also my WhatsApp number</label><p className="hint">Sellers use these details to arrange delivery or pickup.</p></div><div><label className="label" htmlFor="delivery-address">Delivery address</label><textarea id="delivery-address" className="input min-h-24" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Your usual delivery address" /></div>{error && <p className="error">{error}</p>}<button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Save details"}</button></form>;
}
