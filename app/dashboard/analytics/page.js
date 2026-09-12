import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";

function marginPercent(revenue, cost) {
  return revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0;
}

export default async function AnalyticsPage() {
  const { supabase, store } = await getMyStore();
  const [{ data: orders }, { data: sales }, { data: expenses }] = await Promise.all([
    supabase.from("orders").select("id,total,payment_status,status,commission,net_to_seller,created_at,order_items(price,cost_price,quantity)").eq("store_id", store.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("offline_sales").select("amount,sold_at").eq("store_id", store.id).limit(500),
    supabase.from("expenses").select("amount,spent_on,title").eq("store_id", store.id).order("spent_on", { ascending: false }).limit(500),
  ]);
  const paid = (orders || []).filter((order) => order.payment_status === "paid");
  const online = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const onlineCost = paid.reduce((sum, order) => sum + (order.order_items || []).reduce((itemSum, item) => itemSum + (Number(item.cost_price || 0) * Number(item.quantity || 0)), 0), 0);
  const offline = (sales || []).reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const costs = (expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const grossProfit = online - onlineCost;
  const netProfit = grossProfit + offline - costs;
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-kola">Business view</p><h1 className="text-2xl font-bold">Analytics & profit</h1><p className="mt-1 max-w-2xl text-sm text-muted">Add a cost price to each product to see what you actually make after product costs. Older orders without a saved cost are excluded from product-cost totals.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="panel"><p className="text-sm text-muted">Paid online sales</p><p className="mt-1 text-2xl font-bold">{formatNaira(online)}</p></div><div className="panel"><p className="text-sm text-muted">Product costs</p><p className="mt-1 text-2xl font-bold">{formatNaira(onlineCost)}</p></div><div className="panel"><p className="text-sm text-muted">Gross profit</p><p className="mt-1 text-2xl font-bold text-kola">{formatNaira(grossProfit)}</p><p className="mt-1 text-xs text-muted">{marginPercent(online, onlineCost)}% online margin</p></div><div className="panel"><p className="text-sm text-muted">Net after expenses</p><p className={`mt-1 text-2xl font-bold ${netProfit >= 0 ? "text-kola" : "text-danger"}`}>{formatNaira(netProfit)}</p></div></div><section className="panel"><h2 className="font-semibold">Sales performance</h2><div className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><p>Orders: <strong>{orders?.length || 0}</strong></p><p>Paid: <strong>{paid.length}</strong></p><p>Offline sales: <strong>{formatNaira(offline)}</strong></p><p>Delivered: <strong>{(orders || []).filter((order) => order.status === "delivered").length}</strong></p></div></section></div>;
}
