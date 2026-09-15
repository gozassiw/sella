import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createVirtualAccount, providerConfigured } from "@/lib/payments/transactpay";
import { notifyPlatformAdmins } from "@/lib/notifications";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const paidWith = body.paidWith === "wallet" ? "wallet" : "transfer";
  const { data: store } = await supabase.from("stores").select("id,name,approval_status,verification_approved").eq("id", body.storeId).eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  if (store.approval_status !== "approved") return NextResponse.json({ error: "Your store must be approved before paid verification." }, { status: 403 });
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Sella has not set the paid verification price yet." }, { status: 400 });

  if (paidWith === "wallet") {
    const { data, error } = await supabase.rpc("pay_store_verification_from_wallet", { p_store_id: store.id, p_amount: amount });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (data?.paid) await notifyPlatformAdmins({ type: "verification", title: "Paid verification review requested", body: `${store.name} paid for a blue checkmark review.`, link: "/admin?section=badge_reviews" });
    return NextResponse.json(data);
  }
  if (!(await providerConfigured())) return NextResponse.json({ error: "Plan payment is not configured yet." }, { status: 503 });
  const { data: purchase, error: purchaseError } = await supabase.rpc("create_store_verification_purchase", { p_store_id: store.id, p_amount: amount });
  if (purchaseError) return NextResponse.json({ error: purchaseError.message }, { status: 400 });
  try {
    const row = Array.isArray(purchase) ? purchase[0] : purchase;
    const account = await createVirtualAccount({ alias: `sella-verify-${row.id.slice(0, 8)}`, reference: row.id, narration: `Sella blue checkmark review for ${store.name}` });
    const accountNumber = account.accountNumber || account.data?.account_number || account.data?.accountNumber;
    if (!accountNumber) throw new Error("TransactPay did not return an account number.");
    const accountName = account.accountName || account.data?.account_name || account.data?.accountName || null;
    const bankName = account.bank || account.data?.bank_name || account.data?.bank || null;
    const reference = account.accountReference || account.data?.accountReference || row.id;
    const { data: saved, error: saveError } = await supabase.rpc("set_store_verification_payment_account", { p_purchase_id: row.id, p_account_number: accountNumber, p_account_name: accountName, p_bank_name: bankName, p_payment_reference: reference });
    if (saveError) throw saveError;
    return NextResponse.json({ ...row, ...saved, amount, accountNumber, accountName, bankName, reference, paymentAccountExpiresAt: saved.payment_account_expires_at });
  } catch (error) {
    await supabase.from("store_verification_purchases").delete().eq("id", (Array.isArray(purchase) ? purchase[0] : purchase)?.id).eq("store_id", store.id).eq("status", "pending");
    return NextResponse.json({ error: error.message || "Unable to create the verification payment account." }, { status: 502 });
  }
}
