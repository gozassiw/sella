"use client";
import { useState } from "react";

export default function ShareStore({ url, storeName }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your store link:", url);
    }
  }
  const waShare = `https://wa.me/?text=${encodeURIComponent(`Shop from ${storeName} here: ${url}`)}`;
  return (
    <div className="panel">
      <h2 className="font-semibold">Your store link</h2>
      <p className="mt-1 break-all text-sm text-muted">{url}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={copy} className="btn-secondary">{copied ? "Link copied" : "Copy link"}</button>
        <a href={waShare} target="_blank" className="btn-secondary">Share on WhatsApp</a>
        <a href={url} target="_blank" className="btn-secondary">Open store</a>
      </div>
    </div>
  );
}
