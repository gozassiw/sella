import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentTransactionDetails } from "@/lib/payments/transactpay";

function extractPayment(data) {
  const root = data?.data || data?.Data || data || {};
  const status = String(root.status || root.Status || data?.status || data?.Status || "").toLowerCase();
  const statusCode = String(root.statusCode || root.StatusCode || data?.statusCode || data?.StatusCode || root.paymentResponseCode || root.PaymentResponseCode || "");
  const successful = ["successful", "success", "completed", "paid"].includes(status) || statusCode === "00" || String(root.statusId || root.StatusId) === "5";
  const amount = Number(root.totalAmountCharged ?? root.TotalAmountCharged ?? root.orderAmount ?? root.OrderAmount ?? root.amount ?? root.Amount ?? 0);
  const paymentReference = root.paymentReference || root.PaymentReference || root.transactionReference || root.TransactionReference || null;
  const accountReference = root.accountReference || root.AccountReference || null;
  const accountNumber = root.orderPayments?.[0]?.orderPaymentInstrument || root.OrderPayments?.[0]?.orderPaymentInstrument || root.accountNumber || root.AccountNumber || null;
  return { successful, amount, paymentReference, accountReference, accountNumber };
}

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,buyer_id,payment_status,payment_method,payment_total,payment_expires_at,payment_session_id,payment_account_number,payment_reference,order_code")
      .eq("id", body.orderId)
      .eq("buyer_id", user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.payment_method !== "transfer") return NextResponse.json({ error: "This order does not use bank transfer." }, { status: 400 });
    if (order.payment_status === "paid") return NextResponse.json({ paid: true, orderId: order.id });

    if (body.action === "expire") {
      const { data, error } = await supabase.rpc("expire_unpaid_order", { p_order_id: order.id });
      if (error) throw error;
      return NextResponse.json({ ...data, paid: false });
    }

    if (order.payment_expires_at && new Date(order.payment_expires_at).getTime() <= Date.now()) {
      const { data, error } = await supabase.rpc("expire_unpaid_order", { p_order_id: order.id });
      if (error) throw error;
      if (data?.expired) return NextResponse.json({ ...data, paid: false });
    }

    if (!order.payment_session_id) {
      return NextResponse.json({ paid: false, checking: false, message: "Sella is waiting for TransactPay to confirm this transfer. Try again shortly." });
    }

    const providerPayload = await getPaymentTransactionDetails(order.payment_session_id);
    const payment = extractPayment(providerPayload);
    if (!payment.successful) {
      return NextResponse.json({ paid: false, checking: false, message: "No completed payment has arrived for this order yet." });
    }

    const { data: result, error } = await supabase.rpc("process_transactpay_webhook", {
      p_event_key: `${payment.paymentReference || order.payment_session_id}-manual-check`,
      p_payload: providerPayload,
      p_successful: true,
      p_account_number: payment.accountNumber || order.payment_account_number,
      p_account_reference: payment.accountReference,
      p_amount: payment.amount,
      p_payment_reference: payment.paymentReference || order.payment_reference,
      p_order_reference: order.id,
    });
    if (error) throw error;
    const paid = result?.credited === "seller_wallet" || result?.order_id === order.id;
    return NextResponse.json({ paid, result, message: paid ? "Payment confirmed." : "The payment was received but has not matched this order yet." });
  } catch (error) {
    console.error("Payment status check error", error);
    return NextResponse.json({ error: error.message || "Unable to check this payment right now." }, { status: 400 });
  }
}
