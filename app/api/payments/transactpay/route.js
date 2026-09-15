import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPlatformAdmins, notifyUser } from "@/lib/notifications";
import { getPaymentTransactionDetails } from "@/lib/payments/transactpay";

async function notifySafely(input) {
  try {
    await notifyUser(input);
  } catch (error) {
    console.error("TransactPay notification error", error);
  }
}

function signatureIsValid(rawBody, request) {
  const secret = process.env.TRANSACTPAY_WEBHOOK_SECRET;
  if (!secret) return null;
  const provided = request.headers.get("x-transactpay-signature") || request.headers.get("x-webhook-signature");
  if (!provided) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

function eventKey(payload) {
  const data = payload.data || payload.Data || payload;
  return data.paymentReference || data.PaymentReference || data.PayoutReference || data.sessionId || data.SessionId || `${data.orderReference || data.OrderReference || "unknown"}-${data.status || data.Status || "unknown"}-${data.dateUpdated || data.DateUpdated || Date.now()}`;
}

function paymentFields(payload) {
  const data = payload.data || payload.Data || payload;
  return {
    data,
    status: String(data.status || data.Status || payload.status || payload.Status || "").toLowerCase(),
    statusCode: String(data.statusCode || data.StatusCode || payload.statusCode || payload.StatusCode || data.paymentResponseCode || data.PaymentResponseCode || ""),
    accountNumber: data.orderPayments?.[0]?.orderPaymentInstrument || data.OrderPayments?.[0]?.orderPaymentInstrument || data.accountNumber || data.AccountNumber || null,
    accountReference: data.accountReference || data.AccountReference || null,
    amount: Number(data.totalAmountCharged ?? data.TotalAmountCharged ?? data.orderAmount ?? data.OrderAmount ?? data.amount ?? data.Amount ?? 0),
    paymentReference: data.paymentReference || data.PaymentReference || eventKey(payload),
    orderReference: data.orderReference || data.OrderReference || null,
    sessionId: data.sessionId || data.SessionId || null,
  };
}

function isSuccessful(fields) {
  return fields.status === "successful" || fields.status === "success" || fields.status === "completed" || fields.statusCode === "00" || String(fields.data.statusId || fields.data.StatusId) === "5";
}

function verifiedFields(response) {
  const payload = response?.data || response?.Data || response;
  const accountNumber = payload?.orderPayments?.[0]?.orderPaymentInstrument || payload?.OrderPayments?.[0]?.orderPaymentInstrument || payload?.accountNumber || payload?.AccountNumber || null;
  return {
    status: String(payload?.status || payload?.Status || response?.status || response?.Status || "").toLowerCase(),
    statusCode: String(payload?.statusCode || payload?.StatusCode || response?.statusCode || response?.StatusCode || payload?.paymentResponseCode || payload?.PaymentResponseCode || ""),
    amount: Number(payload?.totalAmountCharged ?? payload?.TotalAmountCharged ?? payload?.orderAmount ?? payload?.OrderAmount ?? payload?.amount ?? payload?.Amount ?? payload?.paidAmount ?? payload?.PaidAmount ?? 0),
    paymentReference: payload?.paymentReference || payload?.PaymentReference || payload?.reference || payload?.Reference || null,
    accountNumber,
    accountReference: payload?.accountReference || payload?.AccountReference || null,
    orderReference: payload?.orderReference || payload?.OrderReference || null,
  };
}

async function verifySuccessfulPayment(fields) {
  if (!fields.sessionId) return { ok: false, reason: "missing_session_id" };
  try {
    const providerResponse = await getPaymentTransactionDetails(fields.sessionId);
    const verified = verifiedFields(providerResponse);
    const statusOk = verified.status === "successful" || verified.status === "success" || verified.status === "completed" || verified.statusCode === "00" || verified.statusCode === "200";
    const amountOk = verified.amount > 0 && Math.abs(verified.amount - fields.amount) < 0.01;
    const referenceOk = !verified.paymentReference || !fields.paymentReference || verified.paymentReference === fields.paymentReference;
    const accountOk = (!verified.accountNumber || !fields.accountNumber || verified.accountNumber === fields.accountNumber) && (!verified.accountReference || !fields.accountReference || verified.accountReference === fields.accountReference);
    const identityPresent = Boolean(verified.accountNumber || verified.accountReference || verified.orderReference || verified.paymentReference);
    return { ok: statusOk && amountOk && referenceOk && accountOk && identityPresent, method: "provider_lookup", verified, reason: !statusOk ? "provider_not_successful" : !amountOk ? "amount_mismatch" : !referenceOk ? "reference_mismatch" : !accountOk ? "account_mismatch" : !identityPresent ? "provider_identity_missing" : null };
  } catch (error) {
    console.error("TransactPay provider verification failed", error);
    return { ok: false, reason: "provider_lookup_failed" };
  }
}

export async function POST(request) {
  const rawBody = await request.text();
  const signature = signatureIsValid(rawBody, request);
  if (signature === false) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });

  try {
    const payload = JSON.parse(rawBody);
    const fields = paymentFields(payload);
    const successful = isSuccessful(fields);

    if (successful && signature !== true) {
      const verification = await verifySuccessfulPayment(fields);
      if (!verification.ok) {
        console.error("Rejected unverified successful TransactPay webhook", { reason: verification.reason, hasSessionId: Boolean(fields.sessionId) });
        return NextResponse.json({ error: "Payment could not be verified" }, { status: 401 });
      }
      if (verification.verified?.accountNumber) fields.accountNumber = verification.verified.accountNumber;
      if (verification.verified?.accountReference) fields.accountReference = verification.verified.accountReference;
      if (verification.verified?.orderReference) fields.orderReference = verification.verified.orderReference;
    }

    const supabase = createAdminClient();
    const key = eventKey(payload);
    const subscriptionResult = await supabase.rpc("process_transactpay_subscription", { p_event_key: key, p_payload: payload, p_successful: successful, p_amount: fields.amount, p_payment_reference: fields.paymentReference, p_order_reference: fields.orderReference });
    if (subscriptionResult.error) throw subscriptionResult.error;
    if (subscriptionResult.data?.handled) {
      if (subscriptionResult.data.user_id && subscriptionResult.data.paid) await notifySafely({ userId: subscriptionResult.data.user_id, type: "subscription", title: "Plan upgraded", body: "Your Sella plan payment was confirmed and your store plan is now active.", link: "/dashboard/billing", save: false });
      return NextResponse.json(subscriptionResult.data);
    }

    const verificationResult = await supabase.rpc("process_store_verification_webhook", { p_event_key: key, p_payload: payload, p_successful: successful, p_account_number: fields.accountNumber, p_account_reference: fields.accountReference, p_amount: fields.amount, p_payment_reference: fields.paymentReference, p_order_reference: fields.orderReference });
    if (verificationResult.error) throw verificationResult.error;
    if (verificationResult.data?.handled) {
      if (verificationResult.data.user_id && verificationResult.data.paid) await notifySafely({ userId: verificationResult.data.user_id, type: "verification", title: "Verification payment received", body: "Your blue checkmark review payment was received. Sella Team will review your store.", link: "/dashboard/verification-badge", save: false });
      if (verificationResult.data.paid) await notifyPlatformAdmins({ type: "verification", title: "Paid verification review requested", body: "A seller paid for a blue checkmark review.", link: "/admin?section=badge_reviews" });
      return NextResponse.json(verificationResult.data);
    }

    const { data: result, error } = await supabase.rpc("process_transactpay_webhook", { p_event_key: key, p_payload: payload, p_successful: successful, p_account_number: fields.accountNumber, p_account_reference: fields.accountReference, p_amount: fields.amount, p_payment_reference: fields.paymentReference, p_order_reference: fields.orderReference });
    if (error) throw error;
    if (result?.user_id && result?.credited === "buyer_wallet") await notifySafely({ userId: result.user_id, type: "wallet", title: "Wallet funded", body: `Your Sella wallet received ₦${Number(result.amount || fields.amount).toLocaleString("en-NG")}.`, link: "/account/wallet", save: false });
    if (result?.user_id && result?.credited === "seller_wallet") await notifySafely({ userId: result.user_id, type: "order", title: "Payment received", body: "A buyer payment has been confirmed and added to your seller wallet.", link: "/dashboard/wallet", save: false });
    return NextResponse.json(result || { received: true });
  } catch (error) {
    console.error("TransactPay webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
