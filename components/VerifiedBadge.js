export default function VerifiedBadge({ className = "", label = "Sella approved a separate review of this store’s submitted identity and business information. Not a guarantee of products, delivery or refunds." }) {
  return <span className={`inline-flex h-5 w-5 items-center justify-center ${className}`} title={label} aria-label={label}><img src="/brand/verification-checkmark.png" alt="" aria-hidden="true" className="h-5 w-5 shrink-0 object-contain" /></span>;
}
