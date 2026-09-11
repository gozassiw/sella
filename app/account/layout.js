import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AccountLayout({ children }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");
  return <div className="min-h-screen bg-surface"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><Link href="/" className="font-bold text-kola">Sella</Link><nav className="flex gap-4 text-sm font-semibold"><Link href="/account">Account</Link><Link href="/account/orders">Orders</Link><Link href="/account/wallet">Wallet</Link><Link href="/cart">Cart</Link></nav></div></header><main className="mx-auto max-w-5xl px-5 py-10">{children}</main></div>;
}
