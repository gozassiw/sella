import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isValidSignature(rawBody, request) {
  const secret = process.env.TRANSACTPAY_WEBHOOK_SECRET;
  if (!secret) return true;
  const provided = request.headers.get("x-transactpay-signature") || request.headers.get("x-webhook-signature");
  if (!provided) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function eventKey(payload) {
  const data = payload.data || payload.Data || payload;
  return data.paymentReference || data.PayoutReference || data.sessionId || `${data.orderReference || "unknown"}-${data.status || data.Status || "unknown"}-${data.dateUpdated || data.DateUpdated || "unknown"}`;
}

export async function POST(request) {
  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });

  try {
    const payload = JSON.parse(rawBody);
    const data = payload.data || payload.Data || payload;
    const status = String(data.status || data.Status || "").toLowerCase();
    const successful = status === "successful" || status === "success" || String(data.statusCode || data.StatusCode) === "00";
    const key = eventKey(payload);
    const admin = createAdminClient();
    const { error: eventError } = await admin.from("payment_webhook_events").insert({ provider: "transactpay", event_key: key, payload });
    if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    if (eventError) throw eventError;
    if (!successful) return NextResponse.json({ received: true, ignored: true });

    const accountNumber = data.orderPayments?.[0]?.orderPaymentInstrument || data.accountNumber || null;
    const accountReference = data.accountReference || null;
    const amount = Number(data.totalAmountCharged || data.orderAmount || 0);
    const paymentReference = data.paymentReference || data.PaymentReference || key;

    const { data: buyerWallet } = await admin.from("buyer_wallets")
      .select("id,user_id,balance,dedicated_account_number,dedicated_account_reference")
      .or(`dedicated_account_number.eq.${accountNumber || "__none__"},dedicated_account_reference.eq.${accountReference || "__none__"}`)
      .maybeSingle();
    if (buyerWallet && amount > 0) {
      await admin.from("buyer_wallets").update({ balance: Number(buyerWallet.balance) + amount }).eq("id", buyerWallet.id);
      await admin.from("buyer_wallet_transactions").insert({ buyer_wallet_id: buyerWallet.id, amount, label: "TransactPay wallet funding", provider_reference: paymentReference });
      return NextResponse.json({ received: true, credited: "buyer_wallet" });
    }

    const orderReference = data.orderReference || data.OrderReference;
    let orderQuery = admin.from("orders").select("id,store_id,total,payment_status,order_number").limit(1);
    if (orderReference) orderQuery = orderQuery.or(`id.eq.${orderReference},payment_reference.eq.${orderReference}`);
    else orderQuery = orderQuery.eq("payment_reference", paymentReference);
    const { data: order } = await orderQuery.maybeSingle();
    if (!order || order.payment_status === "paid") return NextResponse.json({ received: true, ignored: true });

    const [{ data: store }, { data: commissionSetting }, { data: thresholdSetting }] = await Promise.all([
      admin.from("stores").select("trusted,completed_orders").eq("id", order.store_id).single(),
      admin.from("app_settings").select("value").eq("key", "commission_rate").maybeSingle(),
      admin.from("app_settings").select("value").eq("key", "trusted_order_threshold").maybeSingle(),
    ]);
    const commissionRate = Math.min(100, Math.max(0, Number(commissionSetting?.value?.rate ?? 5)));
    const commission = Math.round(Number(order.total) * commissionRate / 100 * 100) / 100;
    const net = Number(order.total) - commission;
    const threshold = Math.max(1, Number(thresholdSetting?.value?.count ?? 3));
    const trusted = Boolean(store?.trusted) || Number(store?.completed_orders || 0) >= threshold;
    const { data: wallet } = await admin.from("wallets").select("id,available,held").eq("store_id", order.store_id).maybeSingle();
    const nextAvailable = Number(wallet?.available || 0) + (trusted ? net : 0);
    const nextHeld = Number(wallet?.held || 0) + (trusted ? 0 : net);
    if (wallet) await admin.from("wallets").update({ available: nextAvailable, held: nextHeld }).eq("id", wallet.id);
    else await admin.from("wallets").insert({ store_id: order.store_id, available: trusted ? net : 0, held: trusted ? 0 : net });
    const { data: walletAfter } = await admin.from("wallets").select("id").eq("store_id", order.store_id).single();
    await admin.from("wallet_transactions").insert({ wallet_id: walletAfter.id, order_id: order.id, kind: trusted ? "credit" : "hold", amount: net, note: `TransactPay payment for order #${order.order_number}` });
    await admin.from("orders").update({ payment_status: "paid", paid_at: new Date().toISOString(), escrow_status: trusted ? "released" : "held", commission, net_to_seller: net, payment_reference: paymentReference }).eq("id", order.id);
    return NextResponse.json({ received: true, credited: "seller_wallet" });
  } catch (error) {
    console.error("TransactPay webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
