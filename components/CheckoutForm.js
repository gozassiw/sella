"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatNaira } from "@/lib/utils";
import BankTransferPaymentPanel from "@/components/BankTransferPaymentPanel";
import CheckoutSafetyReminder from "@/components/CheckoutSafetyReminder";

const DETAILS_KEY = "sella-checkout-details";

function readSavedDetails(initialProfile) {
  let saved = {};
  try { saved = JSON.parse(window.localStorage.getItem(DETAILS_KEY) || "{}"); } catch {}
  const callNumber = saved.callNumber || initialProfile?.call_number || "";
  const whatsapp = saved.whatsapp || initialProfile?.whatsapp || "";
  return {
    name: saved.name || initialProfile?.full_name || "",
    callNumber,
    whatsapp,
    address: saved.address || initialProfile?.delivery_address || "",
    fulfilmentMethod: saved.fulfilmentMethod || "delivery",
    paymentMethod: "wallet",
    sameAsWhatsapp: saved.sameAsWhatsapp ?? (!!callNumber && callNumber === whatsapp),
  };
}

export default function CheckoutForm({ initialProfile = null }) {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({ name: "", callNumber: "", whatsapp: "", address: "", fulfilmentMethod: "delivery", paymentMethod: "wallet", sameAsWhatsapp: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [reminder, setReminder] = useState(null);

  useEffect(() => {
    try { setCart(JSON.parse(window.localStorage.getItem("sella-cart") || "[]")); } catch { setCart([]); }
    setForm(readSavedDetails(initialProfile));
  }, [initialProfile]);

  useEffect(() => {
    if (!form.name && !form.callNumber && !form.whatsapp && !form.address) return;
    try { window.localStorage.setItem(DETAILS_KEY, JSON.stringify(form)); } catch {}
  }, [form]);

  const store = cart[0];
  useEffect(() => {
    if (!store?.storeId) return;
    let cancelled = false;
    fetch(`/api/checkout/reminder?storeId=${encodeURIComponent(store.storeId)}`).then((response) => response.json()).then((data) => { if (!cancelled) setReminder(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [store?.storeId]);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  function update(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "sameAsWhatsapp" && value) next.whatsapp = current.callNumber;
      if (key === "callNumber" && current.sameAsWhatsapp) next.whatsapp = value;
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId: store.storeId, items: cart, customer: { name: form.name, phone: form.callNumber, whatsapp: form.whatsapp, address: form.address }, fulfilmentMethod: form.fulfilmentMethod, paymentMethod: form.paymentMethod }) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setError(data.error || "Unable to create your order.");
    if (form.paymentMethod === "wallet") {
      window.localStorage.removeItem("sella-cart");
      window.dispatchEvent(new Event("sella-cart-updated"));
    }
    setResult(data);
  }

  if (!store) return <div className="panel mx-auto max-w-xl text-center"><h1 className="text-2xl font-bold">Your cart is empty</h1><Link href="/cart" className="btn-primary mt-5 inline-flex">Back to cart</Link></div>;
  if (result) return (
    <div className="panel mx-auto max-w-xl">
      <p className="text-sm font-semibold text-kola">Order created</p><h1 className="mt-2 text-2xl font-bold">Thanks, {form.name.split(" ")[0]}</h1>
      {result.paid ? <p className="mt-3 text-muted">Your wallet payment was successful. The seller will contact you to arrange delivery or pickup.</p> : result.account ? <BankTransferPaymentPanel orderId={result.orderId} orderCode={result.orderCode} orderTotal={total} paymentTotal={result.paymentTotal || total} paymentExpiresAt={result.paymentExpiresAt} account={result.account} /> : <p className="mt-3 text-muted">Your order is saved. Payment instructions will appear once the store owner connects TransactPay.</p>}
      <Link href={`/account/orders/${result.orderId}`} className="btn-primary mt-6 inline-flex">View order #{result.orderCode}</Link>
    </div>
  );

  return <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
    <CheckoutSafetyReminder reminder={reminder} />
    <section className="app-card overflow-hidden"><div className="flex items-center gap-3 border-b border-line p-5">{store.storeLogo ? <Image src={store.storeLogo} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-2xl object-cover" /> : <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-kola text-lg font-extrabold text-white">{store.storeName?.charAt(0)}</span>}<div><p className="text-xs font-bold uppercase tracking-wide text-muted">Shopping from</p><p className="mt-1 text-base font-extrabold">{store.storeName}</p></div><Link href="/cart" className="ml-auto text-sm font-semibold text-kola">Back to cart</Link></div><div className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted">Checkout</p><h1 className="mt-1 text-3xl font-bold">Review your items</h1><div className="mt-5 divide-y divide-line">{cart.map((item) => <div key={item.productId} className="flex items-center gap-3 py-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface">{item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-muted">Qty {item.quantity} · {formatNaira(item.price)} each</p></div><p className="text-sm font-extrabold">{formatNaira(item.price * item.quantity)}</p></div>)}</div><div className="mt-4 flex justify-between border-t border-line pt-4 text-lg font-bold"><span>Total</span><span>{formatNaira(total)}</span></div></div></section>
    <div className="panel space-y-4"><h2 className="font-semibold">Your details</h2><div><label className="label">Full name</label><input className="input" required value={form.name} onChange={(e) => update("name", e.target.value)} /></div><div><label className="label">Call number</label><input className="input" required type="tel" value={form.callNumber} onChange={(e) => update("callNumber", e.target.value)} placeholder="0803 123 4567" /></div><div><label className="label">WhatsApp number</label><input className="input" required type="tel" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="0803 123 4567" disabled={form.sameAsWhatsapp} /><label className="mt-3 flex cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#087F5B]" checked={form.sameAsWhatsapp} onChange={(e) => update("sameAsWhatsapp", e.target.checked)} />My call number is also my WhatsApp number</label></div></div>
    <div className="panel space-y-4"><h2 className="font-semibold">Fulfilment</h2><p className="text-sm text-muted">Choose how this seller should fulfil your order. Every order must be delivered or picked up.</p><div className="grid gap-3 md:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-4 ${form.fulfilmentMethod === "delivery" ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" className="mr-2" checked={form.fulfilmentMethod === "delivery"} onChange={() => update("fulfilmentMethod", "delivery")} />Deliver to me</label><label className={`cursor-pointer rounded-xl border p-4 ${form.fulfilmentMethod === "pickup" ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" className="mr-2" checked={form.fulfilmentMethod === "pickup"} onChange={() => update("fulfilmentMethod", "pickup")} />I’ll pick it up</label></div>{form.fulfilmentMethod === "delivery" && <div><label className="label">Delivery address</label><textarea className="input min-h-24" required value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Your saved delivery address" /></div>}<p className="text-sm text-muted">Your delivery address is remembered for your next checkout. The seller will contact you afterward to arrange delivery or pickup and update order progress in Sella.</p></div>
    <div className="panel space-y-4"><h2 className="font-semibold">Payment</h2><label className={`block cursor-pointer rounded-xl border p-4 ${form.paymentMethod === "wallet" ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" className="mr-2" checked={form.paymentMethod === "wallet"} onChange={() => update("paymentMethod", "wallet")} /><strong>Pay from Sella wallet</strong><span className="mt-1 block pl-6 text-sm text-muted">Use your balance across Sella stores.</span></label><label className={`block cursor-pointer rounded-xl border p-4 ${form.paymentMethod === "transfer" ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" className="mr-2" checked={form.paymentMethod === "transfer"} onChange={() => update("paymentMethod", "transfer")} /><strong>Bank transfer</strong><span className="mt-1 block pl-6 text-sm text-muted">Get a unique account number for this order.</span></label></div>
    {error && <p className="error">{error}</p>}<button className="btn-primary w-full py-3.5" disabled={loading}>{loading ? (form.paymentMethod === "wallet" ? "Order Processing" : "Creating order…") : (form.paymentMethod === "wallet" ? "Pay now" : `Place order · ${formatNaira(total)}`)}</button>
  </form>;
}
