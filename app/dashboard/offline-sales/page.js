import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";
import { OfflineSaleForm } from "@/components/OperationsForm";

export default async function OfflineSalesPage() {
  const { supabase, store } = await getMyStore();
  const { data: sales } = await supabase.from("offline_sales").select("id,amount,payment_method,notes,sold_at").eq("store_id", store.id).order("sold_at", { ascending: false }).limit(100);
  const total = (sales || []).reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Offline sales</h1><p className="mt-1 text-sm text-muted">Record WhatsApp, Instagram, walk-in, cash, POS, and transfer sales.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="panel"><p className="text-sm text-muted">Recorded sales</p><p className="mt-1 text-3xl font-bold">{sales?.length || 0}</p></div><div className="panel"><p className="text-sm text-muted">Total recorded</p><p className="mt-1 text-3xl font-bold text-kola">{formatNaira(total)}</p></div></div><section className="panel max-w-xl"><h2 className="font-semibold">Record a sale</h2><div className="mt-5"><OfflineSaleForm storeId={store.id} /></div></section><section className="panel"><h2 className="font-semibold">Recent sales</h2><div className="mt-4 space-y-3">{sales?.length ? sales.map((sale) => <div key={sale.id} className="flex flex-wrap justify-between gap-3 border-b border-line pb-3 text-sm"><span>{new Date(sale.sold_at).toLocaleString("en-NG")} · {sale.payment_method}</span><strong>{formatNaira(sale.amount)}</strong></div>) : <p className="text-sm text-muted">No offline sales recorded.</p>}</div></section></div>;
}
