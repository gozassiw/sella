import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import BuyerBottomNav from "@/components/BuyerBottomNav";
import LiveWorkspaceRefresh from "@/components/LiveWorkspaceRefresh";
import NotificationBell from "@/components/NotificationBell";
import SellaBrand from "@/components/SellaBrand";
import CartIcon from "@/components/CartIcon";

export default async function AccountLayout({ children }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const [{ data: held }, { data: wallet }] = await Promise.all([
    supabase.rpc("is_account_held", { p_user_id: user.id }),
    supabase.rpc("get_or_create_buyer_wallet"),
  ]);
  if (held) return <div className="min-h-screen bg-surface"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-4 sm:px-6"><SellaBrand compact /><span className="text-xs font-bold text-warning">Account on hold</span></div></header><main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-10"><div className="app-card w-full p-7 text-center sm:p-10"><p className="eyebrow text-warning">Sella Team review</p><h1 className="display mt-3 text-3xl">Your buyer account is temporarily paused</h1><p className="mt-4 text-sm leading-6 text-muted">Shopping, wallet transfers, and orders are paused while Sella Team reviews this account. Contact Sella support if you believe this is a mistake.</p></div></main></div>;
  return <div className="min-h-screen bg-surface pb-28"><LiveWorkspaceRefresh scope="buyer" userId={user.id} walletId={wallet?.id} /><header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-4 py-3 sm:px-6"><SellaBrand href="/account" compact /><div className="flex items-center gap-2"><NotificationBell><Link href="/account/notifications" aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink"><Bell size={18} /></Link></NotificationBell><CartIcon /></div></div></header><main className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8">{children}</main><BuyerBottomNav /></div>;
}
