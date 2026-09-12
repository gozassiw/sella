"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CART_KEY = "sella-cart";

export default function AddToCartButton({ product, store, buyNow = false }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;

  function add() {
    if (soldOut) return;
    let existing = [];
    try { existing = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]"); } catch {}
    const differentStore = existing.length && existing[0].storeId !== store.id;
    if (differentStore && !buyNow && !window.confirm("Your cart has items from another store. Replace it with this item?")) return;
    const cart = differentStore || buyNow ? [] : existing;
    const found = cart.find((item) => item.productId === product.id);
    if (found) found.quantity = Math.min(found.quantity + 1, product.stock);
    else cart.push({ productId: product.id, storeId: store.id, storeSlug: store.slug, storeName: store.name, brandColor: store.brand_color, name: product.name, price: Number(product.price), image: product.image_urls?.[0] || "", quantity: 1, stock: product.stock });
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("sella-cart-updated"));
    if (buyNow) router.push("/checkout");
    else {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    }
  }

  return <button onClick={add} disabled={soldOut} className="btn-primary mt-6 w-full py-3.5">{soldOut ? "Sold out" : buyNow ? "Buy now" : added ? "Added to cart" : "Add to cart"}</button>;
}
