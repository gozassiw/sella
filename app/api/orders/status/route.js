import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";

const statusMessages = {
  pending: { title: "Order status updated", body: "Your order is awaiting processing." },
  processing: { title: "Order packed", body: "Your order has been packed by the seller." },
  shipped: { title: "Out for delivery", body: "Your order is now out for delivery." },
  delivered: { title: "Order delivered", body: "Your order has been marked delivered." },
  cancelled: { title: "Order cancelled", body: "Your order has been cancelled by the seller." },
};

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!Object.hasOwn(statusMessages, status) || !body.orderId) return NextResponse.json({ error: "A valid order status is required." }, { status: 400 });

  try {
    const { data: order, error: orderError } = await supabase.from("orders").select("id,order_code,status,buyer_id,store_id,stores(owner_id,name)").eq("id", body.orderId).maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.stores?.owner_id !== user.id) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === status) return NextResponse.json({ success: true, unchanged: true });

    const patch = { status };
    if (status === "shipped") patch.shipped_at = new Date().toISOString();
    if (status === "delivered") patch.delivered_at = new Date().toISOString();
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(patch).eq("id", order.id).eq("store_id", order.store_id);
    if (error) throw error;

    const message = statusMessages[status];
    const bodyText = `${message.body} Order #${order.order_code} from ${order.stores.name}.`;
    if (order.buyer_id) {
      const { error: buyerNotificationError } = await supabase.rpc("notify_order_user", { p_order_id: order.id, p_user_id: order.buyer_id, p_type: "order", p_title: message.title, p_body: bodyText, p_link: `/account/orders/${order.id}` });
      if (buyerNotificationError) console.error("Buyer status notification record failed", buyerNotificationError);
      await notifyUser({ userId: order.buyer_id, type: "order", title: message.title, body: bodyText, link: `/account/orders/${order.id}`, save: false });
    }
    const { error: sellerNotificationError } = await supabase.rpc("notify_order_user", { p_order_id: order.id, p_user_id: user.id, p_type: "order", p_title: message.title, p_body: bodyText, p_link: `/dashboard/orders?order=${order.id}` });
    if (sellerNotificationError) console.error("Seller status notification record failed", sellerNotificationError);
    await notifyUser({ userId: user.id, type: "order", title: message.title, body: bodyText, link: `/dashboard/orders?order=${order.id}`, save: false });
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Order status update error", error);
    return NextResponse.json({ error: error.message || "Unable to update order status." }, { status: 400 });
  }
}
