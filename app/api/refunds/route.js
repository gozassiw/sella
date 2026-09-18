import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createVirtualAccount, providerConfigured } from "@/lib/payments/transactpay";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const refundId = body.refundId;
  if (!refundId) return NextResponse.json({ error: "Refund reference is required." }, { status: 400 });

  try {
    if (action === "process") {
      const { data, error } = await supabase.rpc("process_refund_obligation", { p_refund_id: refundId });
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (action === "fund") {
      const { data: requestData, error: requestError } = await supabase.rpc("get_refund_funding_request", { p_refund_id: refundId });
      if (requestError) throw requestError;
      if (requestData?.account_number && requestData?.expires_at) return NextResponse.json({ ...requestData, accountNumber: requestData.account_number, accountName: requestData.account_name, bankName: requestData.bank_name, reference: requestData.reference, expiresAt: requestData.expires_at });
      if (!(await providerConfigured())) return NextResponse.json({ error: "Refund funding is not configured yet. Contact Sella Team." }, { status: 503 });
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const account = await createVirtualAccount({ alias: `sella-refund-${refundId.slice(0, 8)}`, reference: requestData.refund_reference, narration: `Sella refund funding ${requestData.refund_reference}` });
      const accountNumber = account.accountNumber || account.data?.account_number || account.data?.accountNumber;
      if (!accountNumber) throw new Error("TransactPay did not return an account number.");
      const accountName = account.accountName || account.data?.account_name || account.data?.accountName || null;
      const bankName = account.bank || account.data?.bank_name || account.data?.bank || null;
      const reference = account.accountReference || account.data?.accountReference || requestData.refund_reference;
      const { data, error } = await supabase.rpc("set_refund_payment_account", { p_refund_id: refundId, p_account_number: accountNumber, p_account_name: accountName, p_bank_name: bankName, p_payment_reference: reference, p_expires_at: expiresAt, p_amount: requestData.amount });
      if (error) throw error;
      return NextResponse.json({ ...data, accountNumber, accountName, bankName, reference, expiresAt });
    }

    return NextResponse.json({ error: "Unsupported refund operation." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Refund operation failed." }, { status: 400 });
  }
}
