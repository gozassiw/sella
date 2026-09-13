"use client";

import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";

export default function ShareStore({ url, storeName, sellerCode }) {
  const [copied, setCopied] = useState(false);
  const value = sellerCode || url;
  async function copy() { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Copy the store ID:", value); } }
  const waShare = `https://wa.me/?text=${encodeURIComponent(`To shop from ${storeName} on Sella, open your Sella account and enter store ID ${sellerCode || value}.`)}`;
  return <section className="overflow-hidden rounded-[26px] bg-mango p-6 text-kola-dark"><p className="eyebrow text-kola-dark/60">Your store ID</p><h2 className="display mt-2 text-2xl">Give buyers one simple code.</h2><p className="mt-3 text-sm leading-6 text-kola-dark/75">Buyers enter this ID in their Sella account to open your store, trust it, and start shopping. Your store is not listed in public discovery.</p><p className="mt-5 rounded-2xl bg-white/65 px-4 py-4 text-center text-2xl font-extrabold tracking-[.24em]">{sellerCode || "Generating…"}</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-kola-dark px-4 py-3 text-xs font-extrabold text-white"><Copy size={15} />{copied ? "Copied" : "Copy store ID"}</button><a href={waShare} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-xs font-extrabold"><MessageCircle size={15} />Share ID on WhatsApp</a></div></section>;
}
