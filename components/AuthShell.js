import Link from "next/link";
import { BadgeCheck, ShoppingBag, WalletCards } from "lucide-react";
import SellaBrand from "@/components/SellaBrand";

export default function AuthShell({ title, subtitle, children, footer }) {
  return <div className="min-h-screen bg-white lg:grid lg:grid-cols-[.9fr_1.1fr]">
    <aside className="relative hidden overflow-hidden bg-kola-dark p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <SellaBrand inverted />
      <div className="max-w-md"><span className="chip bg-white/10 text-mango">Commerce, made human</span><h2 className="display mt-6 text-[48px] leading-[1.04]">One account. Trusted stores. Your whole business.</h2><p className="mt-5 text-sm leading-7 text-white/65">Buyers open stores with a seller-provided ID and trust the stores they want to shop from. Sellers manage money, stock, orders, and customers without the usual clutter.</p><div className="mt-10 grid gap-3">{[{ icon: ShoppingBag, text: "Open stores with a unique seller ID" }, { icon: WalletCards, text: "Pay through one reusable buyer wallet" }, { icon: BadgeCheck, text: "Built-in fulfilment and report controls" }].map(({ icon: Icon, text }) => <div key={text} className="flex items-center gap-3 rounded-2xl bg-white/10 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mango text-kola-dark"><Icon size={17} /></span><p className="text-sm font-bold">{text}</p></div>)}</div></div>
      <p className="text-xs text-white/45">Sella · Independent commerce</p>
    </aside>
    <main className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-14">
      <div className="lg:hidden"><SellaBrand /></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <p className="eyebrow text-kola">Welcome to Sella</p>
        <h1 className="display mt-3 text-[36px] leading-tight sm:text-[42px]">{title}</h1>
        {subtitle && <p className="mt-4 text-sm leading-6 text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <p className="mt-7 text-center text-sm text-muted">{footer}</p>}
      </div>
      <Link href="/" className="text-center text-xs font-bold text-muted hover:text-kola">Back to Sella</Link>
    </main>
  </div>;
}
