import Link from "next/link";

export default function SellaBrand({ href = "/", inverted = false, compact = false }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Sella home">
      <span className={`grid h-9 w-9 place-items-center rounded-[11px] text-sm font-extrabold ${inverted ? "bg-mango text-kola-dark" : "bg-kola text-white"}`}>S</span>
      {!compact && <span className={`text-[22px] font-extrabold tracking-[-0.05em] ${inverted ? "text-white" : "text-ink"}`}>Sella<span className="text-mango">.</span></span>}
    </Link>
  );
}
