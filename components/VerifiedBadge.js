import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge({ className = "", label = "Sella verified store" }) {
  return <span className={`inline-flex items-center gap-1 text-[#2563EB] ${className}`} title={label} aria-label={label}><BadgeCheck size={18} fill="currentColor" strokeWidth={1.8} /></span>;
}
