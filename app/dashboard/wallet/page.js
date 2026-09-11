import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";
import { WithdrawalForm } from "@/components/OperationsForm";

export default async function SellerWalletPage() {
  const { supabase, store } = await getMyStore();
  const [{ data: wallet }, { data: withdrawals }, { data: bank }] = await Promise.all([
    supabase.from("wallets").select("available,held").eq("store_id", store.id).maybeSingle(),
    supabase.from("withdrawals").select("id,amount,status,bank_name,account_number,created_at").eq("store_id", store.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("store_bank_accounts").select("bank_name,account_number,account_name").eq("store_id", store.id).maybeSingle(),
  ]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Wallet & withdrawals</h1><p className="mt-1 text-sm text-muted">Paid orders are held until delivery is confirmed.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="panel"><p className="text-sm text-muted">Available</p><p className="mt-1 text-3xl font-bold text-kola">{formatNaira(wallet?.available)}</p></div><div className="panel"><p className="text-sm text-muted">Held</p><p className="mt-1 text-3xl font-bold">{formatNaira(wallet?.held)}</p></div></div><div className="grid gap-6 lg:grid-cols-2"><section className="panel"><h2 className="font-semibold">Request withdrawal</h2><p className="mt-1 text-sm text-muted">Funds are sent after an admin reviews the request.</p><div className="mt-5"><WithdrawalForm storeId={store.id} account={bank} /></div></section><section className="panel"><h2 className="font-semibold">Recent requests</h2><div className="mt-4 space-y-3">{withdrawals?.length ? withdrawals.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-line pb-3 text-sm"><span>{formatNaira(item.amount)} · {item.bank_name} · {item.account_number}</span><span className="capitalize text-muted">{item.status}</span></div>) : <p className="text-sm text-muted">No withdrawal requests yet.</p>}</div></section></div></div>;
}
