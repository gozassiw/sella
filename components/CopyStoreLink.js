"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

export default function CopyStoreLink({ url }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy your store link:", url);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-muted"><Link2 size={13} /> Store link</p>
      <div className="mt-2 flex items-center gap-2">
        <input readOnly value={url} aria-label="Copyable store link" onFocus={(event) => event.target.select()} className="input min-w-0 flex-1 bg-white text-xs" />
        <button type="button" onClick={copy} className="btn-soft shrink-0 px-3 py-2.5 text-xs"><span className="inline-flex items-center gap-1.5">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</span></button>
      </div>
    </div>
  );
}
