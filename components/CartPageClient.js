"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { formatNaira } from "@/lib/utils";

const CART_KEY = "sella-cart";

export default function CartPageClient({ homeHref = "/" }) {
  const [cart, setCart] = useState([]);
  useEffect(() => setCart(JSON.parse(window.localStorage.getItem(CART_KEY) || "[]")), []);
  const store = cart[0];
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  function save(next) {
    setCart(next);
    window.localStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("sella-cart-updated"));
  }
  function change(productId, delta) {
    save(cart.map((item) => item.productId === productId ? { ...item, quantity: Math.max(0, Math.min(item.stock, item.quantity + delta)) } : item).filter((item) => item.quantity > 0));
  }
  function remove(productId) { save(cart.filter((item) => item.productId !== productId)); }

  if (!cart.length) return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-2xl font-bold">Your cart is empty</h1>
      <p className="mt-2 text-muted">Browse a store to add products before checkout.</p>
      <Link href={homeHref} className="btn-primary mt-6 inline-flex">Back to Sella</Link>
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-kola">{store.storeName}</p><h1 className="mt-1 text-3xl font-bold">Your cart</h1></div>
        <Link href={`/s/${store.storeSlug}`} className="text-sm font-semibold text-kola">Continue shopping</Link>
      </div>
      <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
        {cart.map((item) => (
          <div key={item.productId} className="flex gap-4 p-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface">{item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1"><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-muted">{formatNaira(item.price)} each</p><div className="mt-3 flex items-center gap-2"><button onClick={() => change(item.productId, -1)} className="rounded-lg border border-line p-1.5"><Minus size={14} /></button><span className="w-6 text-center text-sm">{item.quantity}</span><button onClick={() => change(item.productId, 1)} disabled={item.quantity >= item.stock} className="rounded-lg border border-line p-1.5 disabled:opacity-40"><Plus size={14} /></button></div></div>
            <div className="flex flex-col items-end justify-between"><p className="font-bold">{formatNaira(item.price * item.quantity)}</p><button onClick={() => remove(item.productId)} className="text-muted hover:text-red-700" aria-label={`Remove ${item.name}`}><Trash2 size={17} /></button></div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-surface p-5"><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatNaira(total)}</span></div><p className="mt-2 text-sm text-muted">No delivery fee is charged by Sella. The seller will contact you to arrange delivery or pickup.</p><Link href="/checkout" className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5">Continue to checkout <ArrowRight size={17} /></Link></div>
    </main>
  );
}
