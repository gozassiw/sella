export default function VerifiedBadge({ className = "", label = "Sella verification checkmark" }) {
  return <span className={`inline-flex items-center gap-1 ${className}`} title={label} aria-label={label}><img src="/brand/verification-checkmark.png" alt="" aria-hidden="true" className="h-[1.15em] w-[1.15em] shrink-0 object-contain" /></span>;
}
