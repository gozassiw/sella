import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeIsOperational } from "@/lib/store";
import { notifyPlatformAdmins, notifyUser } from "@/lib/notifications";

async function requireOperationalStore(supabase, storeId, userId) {
  if (!storeId) return { error: NextResponse.json({ error: "Store is required." }, { status: 400 }) };
  const { data: store } = await supabase.from("stores").select("id,name").eq("id", storeId).eq("owner_id", userId).maybeSingle();
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
    if (action === "cancel") {
      const { data: order } = await supabase.from("orders").select("id,store_id,order_code,total,payment_status,buyer_id,stores(owner_id,name)").eq("id", body.orderId).maybeSingle();
      const guard = await requireOperationalStore(supabase, order?.store_id, user.id);
      if (guard.error) return guard.error;
      const { data, error } = await supabase.rpc("cancel_order_and_refund", { p_order_id: body.orderId, p_reason: body.reason || null });
      if (error) throw error;
      const refundRequired = data?.refund_required === true;
      const refundStatus = data?.refund_status === "pending_funding" ? "Refund funding is required before the buyer can be credited." : "The full refund is ready for the seller to process from the seller balance.";
      const title = refundRequired ? "Refund required" : "Order cancelled";
      const bodyText = refundRequired ? `Order #${order.order_code} from ${order.stores?.name || "the seller"} was cancelled. A full refund of ₦${Number(data.refund_due || order.total || 0).toLocaleString("en-NG")} is due. ${refundStatus}` : `Order #${order.order_code} from ${order.stores?.name || "the seller"} was cancelled.`;
      if (order.buyer_id) {
        const { error: buyerNotificationError } = await supabase.rpc("notify_order_user", { p_order_id: order.id, p_user_id: order.buyer_id, p_type: "order", p_title: title, p_body: bodyText, p_link: `/account/orders/${order.id}` });
        if (buyerNotificationError) console.error("Buyer operations notification record failed", buyerNotificationError);
        await notifyUser({ userId: order.buyer_id, type: "order", title, body: bodyText, link: `/account/orders/${order.id}`, save: false });
      }
      const { error: sellerNotificationError } = await supabase.rpc("notify_order_user", { p_order_id: order.id, p_user_id: user.id, p_type: "order", p_title: title, p_body: bodyText, p_link: `/dashboard/orders?order=${order.id}` });
      if (sellerNotificationError) console.error("Seller operations notification record failed", sellerNotificationError);
      await notifyUser({ userId: user.id, type: "order", title, body: bodyText, link: `/dashboard/orders?order=${order.id}`, save: false });
      if (refundRequired) await notifyPlatformAdmins({ type: "refund", title: "Outstanding refund obligation", body: `Order #${order.order_code} was cancelled by ${order.stores?.name || "a seller"}. Full refund due: ₦${Number(data.refund_due || order.total || 0).toLocaleString("en-NG")}. Status: ${data.refund_status}.`, link: "/admin?section=refunds" });
      return NextResponse.json(data);
    }
    if (["withdraw", "offline_sale"].includes(action)) {
      const guard = await requireOperationalStore(supabase, body.storeId, user.id);
      if (guard.error) return guard.error;
      if (action === "withdraw") {
        const { data, error } = await supabase.rpc("request_store_withdrawal", { p_store_id: body.storeId, p_amount: Number(body.amount), p_bank_name: body.bankName, p_account_number: body.accountNumber, p_account_name: body.accountName || null });
        if (error) throw error;
        const withdrawalMessage = `${guard.store.name || "A seller"} requested a withdrawal of ₦${Number(body.amount).toLocaleString("en-NG")}.`;
        await notifyPlatformAdmins({ type: "withdrawal", title: "New withdrawal request", body: withdrawalMessage, link: "/admin?section=withdrawals" });
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
    if (action === "verification_notification") {
      const { data: store } = await supabase.from("stores").select("id,name").eq("id", body.storeId).eq("owner_id", user.id).maybeSingle();
      if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
      const verificationMessage = `${store.name || "A seller"} submitted seller details and is waiting for Sella verification.`;
      const { error: adminNotificationError } = await supabase.rpc("notify_platform_admins", { p_type: "verification", p_title: "New seller submission", p_body: verificationMessage, p_link: "/admin#approvals" });
      if (adminNotificationError) console.error("Admin verification notification record failed", adminNotificationError);
      await notifyPlatformAdmins({ type: "verification", title: "New seller submission", body: verificationMessage, link: "/admin#approvals" });
      return NextResponse.json({ success: true });
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
