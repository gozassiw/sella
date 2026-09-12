import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import CartPageClient from "@/components/CartPageClient";

export default async function CartPage() {
  const { user } = await getCurrentUser();
  const homeHref = user ? "/account" : "/";
  return <div className="min-h-screen bg-surface"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5"><Link href={homeHref} className="font-bold text-kola">Sella</Link>{user ? <Link href="/account" className="font-semibold text-kola">Account</Link> : <div className="flex items-center gap-3 text-sm"><Link href="/login?next=%2Fcart" className="font-semibold text-kola">Log in</Link><Link href="/signup?next=%2Fcart" className="font-semibold text-kola">Create account</Link></div>}</div></header><CartPageClient homeHref={homeHref} /></div>;
}
