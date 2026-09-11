"use client";
import { useState } from "react";
export default function CopyButton({ value }) { const [copied, setCopied] = useState(false); async function copy() { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } } return <button type="button" onClick={copy} className="btn-secondary px-3 py-2 text-xs">{copied ? "Copied" : "Copy"}</button>; }
