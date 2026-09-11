"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatNaira } from "@/lib/utils";

export default function CheckoutForm() {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", fulfilmentMethod: "delivery", paymentMethod: "transfer" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  useEffect(() => setCart(JSON.parse(window.localStorage.getItem("sella-cart") || "[]")), []);
  const store = cart[0];
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId: store.storeId, items: cart, customer: form, fulfilmentMethod: form.fulfilmentMethod, paymentMethod: form.paymentMethod }) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error || "Unable to create your order.");
    window.localStorage.removeItem("sella-cart");
    window.dispatchEvent(new Event("sella-cart-updated"));
    setResult(data);
  }

  if (!store) return <div className="panel mx-auto max-w-xl text-center"><h1 className="text-2xl font-bold">Your cart is empty</h1><Link href="/cart" className="btn-primary mt-5 inline-flex">Back to cart</Link></div>;
  if (result) return (
    <div className="panel mx-auto max-w-xl">
      <p className="text-sm font-semibold text-kola">Order created</p><h1 className="mt-2 text-2xl font-bold">Thanks, {form.name.split(" ")[0]}</h1>
      {result.paid ? <p className="mt-3 text-muted">Your wallet payment was successful. The seller will contact you to arrange delivery or pickup.</p> : result.account ? <><p className="mt-3 text-muted">Transfer {formatNaira(total)} to this account. Your order will update automatically when TransactPay confirms the payment.</p><div className="mt-5 rounded-2xl bg-surface p-5"><p className="text-sm text-muted">Bank</p><p className="font-semibold">{result.account.bank || "TransactPay partner bank"}</p><p className="mt-3 text-sm text-muted">Account number</p><p className="text-2xl font-bold tracking-wide">{result.account.number}</p>{result.account.name && <p className="mt-1 text-sm text-muted">{result.account.name}</p>}</div></> : <p className="mt-3 text-muted">Your order is saved. Payment instructions will appear once the store owner connects TransactPay.</p>}
      <Link href={`/account/orders/${result.orderId}`} className="btn-primary mt-6 inline-flex">View my order</Link>
    </div>
  );

  return <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6"><div><p className="text-sm font-semibold text-kola">{store.storeName}</p><h1 className="mt-1 text-3xl font-bold">Checkout</h1><p className="mt-2 text-sm text-muted">Total: <strong className="text-ink">{formatNaira(total)}</strong></p></div><div className="panel space-y-4"><h2 className="font-semibold">Your details</h2><div><label className="label">Full name</label><input className="input" required value={form.name} onChange={(e) => update("name", e.target.value)} /></div><div className="grid gap-4 md:grid-cols-2"><div><label className="label">Phone number</label><input className="input" required type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div><div><label className="label">Email</label><input className="input" required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div></div></div><div className="panel space-y-4"><h2 className="font-semibold">Fulfilment</h2><div className="grid gap-3 md:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-4 ${form.fulfilmentMethod === "delivery" ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" className="mr-2" checked={form.fulfilmentMethod === "delivery"} onChange={() => update("fulfilmentMethod", "delivery")} />Deliver to me</label><label className={`cursor-pointer rounded-xl border p-4 ${form.fulfilmentMethod === "pickup" ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" className="mr-2" checked={form.fulfilmentMethod === "pickup"} onChange={() => update("fulfilmentMethod", "pickup")} />I’ll pick it up</label></div>{form.fulfilmentMethod === "delivery" && <div><label className="label">Delivery address</label><textarea className="input min-h-24" required value={form.address} onChange={(e) => update("address", e.target.value)} /></div>}<p className="text-sm text-muted">The seller will contact you afterward to arrange delivery or pickup and any delivery cost. Sella does not set or charge a delivery fee.</p></div><div className="panel space-y-4"><h2 className="font-semibold">Payment</h2><label className={`block cursor-pointer rounded-xl border p-4 ${form.paymentMethod === "transfer" ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" className="mr-2" checked={form.paymentMethod === "transfer"} onChange={() => update("paymentMethod", "transfer")} /><strong>Bank transfer</strong><span className="mt-1 block pl-6 text-sm text-muted">Get a unique account number for this order.</span></label><label className={`block cursor-pointer rounded-xl border p-4 ${form.paymentMethod === "wallet" ? "border-kola bg-kola-light" : "border-line"}`}><input type="radio" className="mr-2" checked={form.paymentMethod === "wallet"} onChange={() => update("paymentMethod", "wallet")} /><strong>Pay from Sella wallet</strong><span className="mt-1 block pl-6 text-sm text-muted">Use your balance across Sella stores.</span></label></div>{error && <p className="error">{error} {error.includes("log in") && <Link className="font-semibold underline" href={`/login?next=/checkout`}>Log in</Link>}</p>}<button className="btn-primary w-full py-3.5" disabled={loading}>{loading ? "Creating order…" : `Place order · ${formatNaira(total)}`}</button></form>;
}
