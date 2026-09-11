"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

export default function CartLink({ color = "#0E5E4A" }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => {
      const cart = JSON.parse(window.localStorage.getItem("sella-cart") || "[]");
      setCount(cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
    };
    update();
    window.addEventListener("sella-cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("sella-cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return (
    <Link href="/cart" className="relative inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold" style={{ color }}>
      <ShoppingBag size={17} /> Cart
      {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-mango px-1 text-xs text-ink">{count}</span>}
    </Link>
  );
}
