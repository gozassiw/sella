import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isValidSignature(rawBody, request) {
  const secret = process.env.TRANSACTPAY_WEBHOOK_SECRET;
  if (!secret) return true;
  const provided = request.headers.get("x-transactpay-signature") || request.headers.get("x-webhook-signature");
  // TransactPay's documented webhook examples do not include a signature header.
  // Do not block genuine funding events when this optional local secret is set.
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
    const { data: result, error } = await supabase.rpc("process_transactpay_webhook", {
      p_event_key: eventKey(payload),
      p_payload: payload,
      p_successful: successful,
      p_account_number: accountNumber,
      p_account_reference: accountReference,
      p_amount: amount,
      p_payment_reference: paymentReference,
      p_order_reference: orderReference,
    });
    if (error) throw error;
    return NextResponse.json(result || { received: true });
  } catch (error) {
    console.error("TransactPay webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
