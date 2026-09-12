import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";

export default async function OrdersPage() {
  const { supabase, user } = await getCurrentUser();
  const { data: orders } = await supabase.from("orders").select("id,order_number,total,status,payment_status,fulfilment_method,created_at,stores(name,slug)").eq("buyer_id", user.id).order("created_at", { ascending: false });
  return <div><h1 className="text-3xl font-bold">My orders</h1><div className="mt-6 space-y-3">{orders?.length ? orders.map((order) => <Link key={order.id} href={`/account/orders/${order.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white p-5 hover:border-kola"><div><p className="font-semibold">{order.stores?.name || "Store"}</p><p className="mt-1 text-sm text-muted">Order #{order.order_number} · {order.fulfilment_method}</p></div><div className="text-right"><p className="font-bold">{formatNaira(order.total)}</p><p className="mt-1 text-xs capitalize text-muted">{order.status} · {order.payment_status}</p></div></Link>) : <div className="panel text-muted">No orders yet. <Link href="/" className="font-semibold text-kola">Browse Sella stores.</Link></div>}</div></div>;
}
