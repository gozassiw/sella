import Link from "next/link";
import CheckoutForm from "@/components/CheckoutForm";

export default function CheckoutPage() {
  return <div className="min-h-screen bg-surface"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5"><Link href="/" className="font-bold text-kola">Sella</Link><Link href="/cart" className="text-sm font-semibold text-kola">Back to cart</Link></div></header><main className="px-5 py-10"><CheckoutForm /></main></div>;
}
