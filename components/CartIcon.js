"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

export default function CartIcon() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => { try { const cart = JSON.parse(window.localStorage.getItem("sella-cart") || "[]"); setCount(cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)); } catch { setCount(0); } };
    update(); window.addEventListener("sella-cart-updated", update); window.addEventListener("storage", update);
    return () => { window.removeEventListener("sella-cart-updated", update); window.removeEventListener("storage", update); };
  }, []);
  return <Link href="/cart" aria-label={`Cart${count ? `, ${count} items` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-full bg-kola text-white"><ShoppingBag size={17} />{count > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-mango px-1 text-[9px] font-extrabold text-kola-dark">{count > 9 ? "9+" : count}</span>}</Link>;
}
