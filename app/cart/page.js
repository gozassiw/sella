import Link from "next/link";
import CartPageClient from "@/components/CartPageClient";

export default function CartPage() {
  return <div className="min-h-screen bg-surface"><header className="border-b border-line bg-white"><div className="mx-auto max-w-3xl px-5 py-5"><Link href="/" className="font-bold text-kola">Sella</Link></div></header><CartPageClient /></div>;
}
