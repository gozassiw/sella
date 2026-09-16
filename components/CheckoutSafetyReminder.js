"use client";

import Image from "next/image";
import Link from "next/link";

export default function CheckoutSafetyReminder({ reminder }) {
  if (!reminder?.firstPurchase || !reminder.store) return null;
  const { store } = reminder;
  return <aside className="rounded-2xl border border-kola/20 bg-kola-light p-4" aria-label="Store safety reminder">
    <div className="flex items-start gap-3">
      {store.logoUrl ? <Image src={store.logoUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kola text-sm font-extrabold text-white">{store.name?.charAt(0)?.toUpperCase() || "S"}</span>}
      <div className="min-w-0"><p className="text-sm font-extrabold text-kola-dark">Buying from {store.name}</p><p className="mt-1 text-xs leading-5 text-kola-dark">This is an independent store. Please review the product details, delivery arrangements and seller information before paying.</p></div>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-kola"><Link href={store.storeUrl}>Store information</Link>{store.deliveryUrl ? <Link href={store.deliveryUrl}>Delivery terms</Link> : <span className="font-normal text-muted">Delivery terms: ask seller</span>}<Link href={store.refundUrl}>Ask about refunds</Link></div>
  </aside>;
}
