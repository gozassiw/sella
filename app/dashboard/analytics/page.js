import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";

export default async function AnalyticsPage() {
  const { supabase, store } = await getMyStore();
  const [{ data: orders }, { data: sales }, { data: expenses }] = await Promise.all([
    supabase.from("orders").select("total,payment_status,status,commission,net_to_seller,created_at").eq("store_id", store.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("offline_sales").select("amount,sold_at").eq("store_id", store.id).limit(500),
    supabase.from("expenses").select("amount,spent_on,title").eq("store_id", store.id).order("spent_on", { ascending: false }).limit(500),
  ]);
  const paid = (orders || []).filter((order) => order.payment_status === "paid");
  const online = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const offline = (sales || []).reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const costs = (expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Analytics & profit</h1><p className="mt-1 text-sm text-muted">A simple view of your online, offline, and expense records.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="panel"><p className="text-sm text-muted">Paid online</p><p className="mt-1 text-2xl font-bold">{formatNaira(online)}</p></div><div className="panel"><p className="text-sm text-muted">Offline sales</p><p className="mt-1 text-2xl font-bold">{formatNaira(offline)}</p></div><div className="panel"><p className="text-sm text-muted">Expenses</p><p className="mt-1 text-2xl font-bold">{formatNaira(costs)}</p></div><div className="panel"><p className="text-sm text-muted">Recorded profit</p><p className="mt-1 text-2xl font-bold text-kola">{formatNaira(online + offline - costs)}</p></div></div><section className="panel"><h2 className="font-semibold">Order performance</h2><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><p>Orders: <strong>{orders?.length || 0}</strong></p><p>Paid: <strong>{paid.length}</strong></p><p>Delivered: <strong>{(orders || []).filter((order) => order.status === "delivered").length}</strong></p></div></section></div>;
}
