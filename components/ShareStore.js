"use client";
import { useState } from "react";
import { ArrowUpRight, Copy, MessageCircle } from "lucide-react";

export default function ShareStore({ url, storeName }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Copy your store link:", url); } }
  const waShare = `https://wa.me/?text=${encodeURIComponent(`Shop from ${storeName} here: ${url}`)}`;
  return <section className="overflow-hidden rounded-[26px] bg-mango p-6 text-kola-dark"><p className="eyebrow text-kola-dark/60">Your storefront</p><h2 className="display mt-2 text-2xl">Put your store in front of someone.</h2><p className="mt-3 break-all text-xs font-semibold text-kola-dark/65">{url}</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-kola-dark px-4 py-3 text-xs font-extrabold text-white"><Copy size={15} />{copied ? "Copied" : "Copy link"}</button><a href={waShare} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-xs font-extrabold"><MessageCircle size={15} />WhatsApp</a><a href={url} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-xs font-extrabold">Open <ArrowUpRight size={15} /></a></div></section>;
}
