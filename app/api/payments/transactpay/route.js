import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";

async function notifySafely(input) {
  try {
    await notifyUser(input);
  } catch (error) {
    console.error("TransactPay notification error", error);
  }
}

function isValidSignature(rawBody, request) {
  const secret = process.env.TRANSACTPAY_WEBHOOK_SECRET;
  if (!secret) return true;
  const provided = request.headers.get("x-transactpay-signature") || request.headers.get("x-webhook-signature");
  if (!provided) return true;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function eventKey(payload) {
  const data = payload.data || payload.Data || payload;
  return data.paymentReference || data.PaymentReference || data.PayoutReference || data.sessionId || data.SessionId || `${data.orderReference || data.OrderReference || "unknown"}-${data.status || data.Status || "unknown"}-${data.dateUpdated || data.DateUpdated || Date.now()}`;
}

export async function POST(request) {
  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  try {
    const payload = JSON.parse(rawBody);
    const data = payload.data || payload.Data || payload;
    const status = String(data.status || data.Status || payload.status || payload.Status || "").toLowerCase();
    const statusCode = String(data.statusCode || data.StatusCode || payload.statusCode || payload.StatusCode || data.paymentResponseCode || data.PaymentResponseCode || "");
    const successful = status === "successful" || status === "success" || status === "completed" || statusCode === "00" || String(data.statusId || data.StatusId) === "5";
    const accountNumber = data.orderPayments?.[0]?.orderPaymentInstrument || data.OrderPayments?.[0]?.orderPaymentInstrument || data.accountNumber || data.AccountNumber || null;
    const accountReference = data.accountReference || data.AccountReference || null;
    const amount = Number(data.totalAmountCharged ?? data.TotalAmountCharged ?? data.orderAmount ?? data.OrderAmount ?? data.amount ?? data.Amount ?? 0);
    const paymentReference = data.paymentReference || data.PaymentReference || eventKey(payload);
    const orderReference = data.orderReference || data.OrderReference || null;
    const supabase = createClient();
    const key = eventKey(payload);
    const subscriptionResult = await supabase.rpc("process_transactpay_subscription", { p_event_key: key, p_payload: payload, p_successful: successful, p_amount: amount, p_payment_reference: paymentReference, p_order_reference: orderReference });
    if (subscriptionResult.error) throw subscriptionResult.error;
    if (subscriptionResult.data?.handled) {
      if (subscriptionResult.data.user_id && subscriptionResult.data.paid) await notifySafely({ userId: subscriptionResult.data.user_id, type: "subscription", title: "Plan upgraded", body: "Your Sella plan payment was confirmed and your store plan is now active.", link: "/dashboard/billing", save: false });
      return NextResponse.json(subscriptionResult.data);
    }
    const { data: result, error } = await supabase.rpc("process_transactpay_webhook", { p_event_key: key, p_payload: payload, p_successful: successful, p_account_number: accountNumber, p_account_reference: accountReference, p_amount: amount, p_payment_reference: paymentReference, p_order_reference: orderReference });
    if (error) throw error;
    if (result?.user_id && result?.credited === "buyer_wallet") await notifySafely({ userId: result.user_id, type: "wallet", title: "Wallet funded", body: `Your Sella wallet received ₦${Number(result.amount || amount).toLocaleString("en-NG")}.`, link: "/account/wallet", save: false });
    if (result?.user_id && result?.credited === "seller_wallet") await notifySafely({ userId: result.user_id, type: "order", title: "Payment received", body: "A buyer payment has been confirmed and added to your seller wallet.", link: "/dashboard/wallet", save: false });
    return NextResponse.json(result || { received: true });
  } catch (error) {
    console.error("TransactPay webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
