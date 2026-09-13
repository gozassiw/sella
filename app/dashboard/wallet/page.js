import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";
import { WithdrawalForm } from "@/components/OperationsForm";

export default async function SellerWalletPage() {
  const { supabase, store } = await getMyStore();
  const [{ data: wallet }, { data: withdrawals }, { data: bank }] = await Promise.all([
    supabase.from("wallets").select("available").eq("store_id", store.id).maybeSingle(),
    supabase.from("withdrawals").select("id,amount,fee,payout_amount,status,bank_name,account_number,created_at").eq("store_id", store.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("store_bank_accounts").select("bank_name,account_number,account_name").eq("store_id", store.id).maybeSingle(),
  ]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Wallet & withdrawals</h1><p className="mt-1 text-sm text-muted">Paid orders go straight into your available Sella balance.</p></div><div className="panel"><p className="text-sm text-muted">Available to withdraw</p><p className="mt-1 text-3xl font-bold text-kola">{formatNaira(wallet?.available)}</p><p className="mt-2 text-xs text-muted">Paid order funds are available immediately after confirmation.</p></div><div className="grid gap-6 lg:grid-cols-2"><section className="panel"><h2 className="font-semibold">Request withdrawal</h2><p className="mt-1 text-sm text-muted">Sella deducts a fixed ₦120 payout fee. For example, a ₦10,000 request pays ₦9,880 to your bank account.</p><div className="mt-5"><WithdrawalForm storeId={store.id} account={bank} /></div></section><section className="panel"><h2 className="font-semibold">Recent requests</h2><div className="mt-4 space-y-3">{withdrawals?.length ? withdrawals.map((item) => <div key={item.id} className="border-b border-line pb-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-extrabold">{formatNaira(item.amount)} requested</span><span className="capitalize text-muted">{item.status}</span></div><p className="mt-1 text-xs text-muted">Fee {formatNaira(item.fee || 120)} · payout {formatNaira(item.payout_amount ?? Number(item.amount || 0) - Number(item.fee || 120))} · {item.bank_name} · {item.account_number}</p></div>) : <p className="text-sm text-muted">No withdrawal requests yet.</p>}</div></section></div></div>;
}
