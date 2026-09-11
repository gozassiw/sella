import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  try {
    if (action === "release") {
      const { data, error } = await supabase.rpc("release_order_escrow", { p_order_id: body.orderId, p_delivery_code: body.deliveryCode });
      if (error) throw error;
      return NextResponse.json(data);
    }
    if (action === "cancel") {
      const { data, error } = await supabase.rpc("cancel_order_and_refund", { p_order_id: body.orderId, p_reason: body.reason || null });
      if (error) throw error;
      return NextResponse.json(data);
    }
    if (action === "withdraw") {
      const { data, error } = await supabase.rpc("request_store_withdrawal", { p_store_id: body.storeId, p_amount: Number(body.amount), p_bank_name: body.bankName, p_account_number: body.accountNumber, p_account_name: body.accountName || null });
      if (error) throw error;
      return NextResponse.json(data);
    }
    if (action === "offline_sale") {
      const { data: store } = await supabase.from("stores").select("id").eq("id", body.storeId).eq("owner_id", user.id).maybeSingle();
      if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
      const { data, error } = await supabase.from("offline_sales").insert({ store_id: store.id, amount: Number(body.amount), payment_method: body.paymentMethod || "cash", notes: body.notes || null, sold_at: body.soldAt || new Date().toISOString() }).select("id").single();
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
      const { data, error } = await supabase.from("stores").update({ legal_name: body.legalName || null, nin: body.nin || null, nin_status: body.nin ? "pending" : "none", cac_number: body.cacNumber || null, cac_file_url: body.cacFileUrl || null }).eq("id", body.storeId).eq("owner_id", user.id).select("id").single();
      if (error) throw error;
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Operation failed." }, { status: 400 });
  }
}
