import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.refundId) return NextResponse.json({ error: "Refund reference is required." }, { status: 400 });
  const { data, error } = await supabase.rpc("retry_refund_from_wallet", { p_refund_id: body.refundId });
  if (error) return NextResponse.json({ error: error.message || "Refund could not be retried." }, { status: 400 });
  if (data?.credited_now === true) {
    const { data: refund } = await supabase.from("refund_obligations").select("buyer_id,refund_amount,orders(id,order_code)").eq("id", body.refundId).maybeSingle();
    if (refund?.buyer_id) await notifyUser({ userId: refund.buyer_id, type: "refund", title: "Refund credited", body: `Your refund for order #${refund.orders?.order_code || ""} has been credited to your Sella wallet.`, link: `/account/orders/${refund.orders?.id || ""}`, save: false });
  }
  return NextResponse.json(data);
}