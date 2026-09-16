import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Landmark, WalletCards } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { ensureBuyerWallet } from "@/lib/buyer";
import { formatNaira } from "@/lib/utils";
import GenerateWalletAccountButton from "@/components/GenerateWalletAccountButton";
import CopyButton from "@/components/CopyButton";

export default async function WalletPage() {
  const { supabase, user } = await getCurrentUser();
  let wallet = null;
  try { wallet = await ensureBuyerWallet(user); } catch { wallet = null; }
  let transactions = [];
  if (wallet?.id) {
    const { data } = await supabase.from("buyer_wallet_transactions").select("id,amount,label,provider_reference,created_at,order_id").eq("buyer_wallet_id", wallet.id).order("created_at", { ascending: false }).limit(12);
    transactions = data || [];
    const orderIds = transactions.map((txn) => txn.order_id).filter(Boolean);
    if (orderIds.length) {
      const { data: orders } = await supabase.from("orders").select("id,order_code,store_id,stores(name)").in("id", orderIds).limit(12);
      const orderMap = new Map((orders || []).map((order) => [order.id, order]));
      transactions = transactions.map((txn) => ({ ...txn, order: txn.order_id ? orderMap.get(txn.order_id) || null : null }));
    }
  }
  return <div className="mx-auto max-w-3xl space-y-8">
    <header><p className="eyebrow text-kola">Money</p><h1 className="display mt-2 text-3xl">Your wallet</h1><p className="mt-2 text-sm leading-6 text-muted">Fund once, then pay sellers across Sella.</p></header>
    <section className="relative overflow-hidden rounded-[28px] bg-kola-dark p-6 text-white sm:p-7" style={{ boxShadow: "0 18px 45px rgba(9,84,58,.22)" }}><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-white/60">AVAILABLE BALANCE</p><p className="display mt-3 text-4xl sm:text-[42px]">{formatNaira(wallet?.balance)}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-mango"><WalletCards size={21} /></span></div><p className="mt-8 text-xs text-white/55">Use this balance at any store on Sella.</p></section>
    {wallet?.dedicated_account_number ? <section className="app-card overflow-hidden"><div className="border-b border-line p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-kola-light text-kola"><Landmark size={19} /></span><div><h2 className="text-sm font-extrabold">Your funding account</h2><p className="mt-1 text-xs text-muted">Transfers here credit your Sella wallet.</p></div></div></div><div className="p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Account number</p><div className="mt-2 flex items-center justify-between gap-3"><p className="text-2xl font-extrabold tracking-[.05em]">{wallet.dedicated_account_number}</p><CopyButton value={wallet.dedicated_account_number} /></div><div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5"><div><p className="text-[10px] font-bold text-muted">BANK</p><p className="mt-1 text-xs font-bold">{wallet.dedicated_bank_name || "TransactPay partner bank"}</p></div><div><p className="text-[10px] font-bold text-muted">ACCOUNT NAME</p><p className="mt-1 text-xs font-bold">{wallet.dedicated_account_name || "Sella wallet"}</p></div></div></div></section> : <section className="app-card p-6"><span className="grid h-12 w-12 place-items-center rounded-[18px] bg-mango text-kola-dark"><Landmark size={21} /></span><h2 className="mt-5 text-base font-extrabold">Create your account number</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted">You will get a dedicated bank account. Any successful transfer to it lands in this wallet.</p><div className="mt-5"><GenerateWalletAccountButton /></div></section>}
    <section><div className="flex items-center justify-between"><h2 className="text-base font-extrabold">Recent activity</h2><span className="text-xs font-bold text-muted">Latest 12</span></div><div className="app-card mt-4 divide-y divide-line overflow-hidden">{transactions.length ? transactions.map((txn) => { const amount = Number(txn.amount || 0); const debit = amount < 0; const order = txn.order; const detail = debit && order ? `Order #${order.order_code}${order.stores?.name ? ` · ${order.stores.name}` : ""}` : "Wallet deposit"; const row = <div className="flex items-center gap-3 p-4"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${debit ? "bg-surface text-ink" : "bg-kola-light text-kola"}`}>{debit ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{debit ? "Order payment" : "Wallet deposit"}</p><p className="mt-1 truncate text-[11px] text-muted">{detail} · {new Date(txn.created_at).toLocaleString()}</p></div><p className={`text-sm font-extrabold ${debit ? "text-ink" : "text-success"}`}>{debit ? "-" : "+"}{formatNaira(Math.abs(amount))}</p></div>; return debit && txn.order_id ? <Link key={txn.id} href={`/account/orders/${txn.order_id}`} className="block hover:bg-surface">{row}</Link> : <div key={txn.id}>{row}</div>; }) : <p className="p-8 text-center text-sm text-muted">No wallet activity yet.</p>}</div></section>
  </div>;
}
