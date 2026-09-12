import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeIsOperational } from "@/lib/store";
import { notifyUser } from "@/lib/notifications";

async function requireOperationalStore(supabase, storeId, userId) {
  if (!storeId) return { error: NextResponse.json({ error: "Store is required." }, { status: 400 }) };
  const { data: store } = await supabase.from("stores").select("id").eq("id", storeId).eq("owner_id", userId).maybeSingle();
  if (!store) return { error: NextResponse.json({ error: "Store not found." }, { status: 404 }) };
  if (!(await storeIsOperational(supabase, storeId))) return { error: NextResponse.json({ error: "Your store is awaiting Sella verification. This action is available after approval." }, { status: 403 }) };
  return { store };
}

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  try {
    if (["release", "cancel"].includes(action)) {
      const { data: order } = await supabase.from("orders").select("id,store_id,order_code,buyer_id,stores(owner_id,name)").eq("id", body.orderId).maybeSingle();
      const guard = await requireOperationalStore(supabase, order?.store_id, user.id);
      if (guard.error) return guard.error;
      const rpc = action === "release" ? "release_order_escrow" : "cancel_order_and_refund";
      const params = action === "release" ? { p_order_id: body.orderId, p_delivery_code: body.deliveryCode } : { p_order_id: body.orderId, p_reason: body.reason || null };
      const { data, error } = await supabase.rpc(rpc, params);
      if (error) throw error;
      const completed = action === "release";
      const title = completed ? "Delivery completed" : "Order cancelled";
      const bodyText = completed ? `Order #${order.order_code} from ${order.stores?.name || "the seller"} was delivered and payment was released.` : `Order #${order.order_code} from ${order.stores?.name || "the seller"} was cancelled.`;
      if (order.buyer_id) await notifyUser({ userId: order.buyer_id, type: "order", title, body: bodyText, link: `/account/orders/${order.id}` });
      await notifyUser({ userId: user.id, type: "order", title, body: bodyText, link: `/dashboard/orders?order=${order.id}` });
      return NextResponse.json(data);
    }
    if (["withdraw", "offline_sale"].includes(action)) {
      const guard = await requireOperationalStore(supabase, body.storeId, user.id);
      if (guard.error) return guard.error;
      if (action === "withdraw") {
        const { data, error } = await supabase.rpc("request_store_withdrawal", { p_store_id: body.storeId, p_amount: Number(body.amount), p_bank_name: body.bankName, p_account_number: body.accountNumber, p_account_name: body.accountName || null });
        if (error) throw error;
        return NextResponse.json(data);
      }
      const { data, error } = await supabase.from("offline_sales").insert({ store_id: body.storeId, amount: Number(body.amount), payment_method: body.paymentMethod || "cash", notes: body.notes || null, sold_at: body.soldAt || new Date().toISOString() }).select("id").single();
      if (error) throw error;
      return NextResponse.json(data);
    }
    if (action === "bank_account") {
      const { data: store } = await supabase.from("stores").select("id").eq("id", body.storeId).eq("owner_id", user.id).maybeSingle();
      if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
      const { data, error } = await supabase.from("store_bank_accounts").upsert({ store_id: store.id, bank_name: body.bankName, account_number: body.accountNumber, account_name: body.accountName, updated_at: new Date().toISOString() }, { onConflict: "store_id" }).select("id").single();
      if (error) throw error;
      return NextResponse.json(data);
    }
    if (action === "verification") {
      const nin = String(body.nin || "").replace(/\D/g, "");
      if (nin.length !== 11) return NextResponse.json({ error: "NIN must contain 11 digits." }, { status: 400 });
      const { data, error } = await supabase.from("stores").update({ legal_name: body.legalName || null, nin, nin_status: "pending", cac_number: body.cacNumber || null, cac_file_url: body.cacFileUrl || null, verification_notes: body.notes || null, onboarding_submitted_at: new Date().toISOString(), approval_status: "pending", is_published: false }).eq("id", body.storeId).eq("owner_id", user.id).select("id").single();
      if (error) throw error;
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Operation failed." }, { status: 400 });
  }
}
