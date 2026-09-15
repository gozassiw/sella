import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createVirtualAccount, providerConfigured } from "@/lib/payments/transactpay";
import { storeIsOperational } from "@/lib/store";

const plans = { basic: { amount: 7500, days: 90 }, plus: { amount: 14000, days: 180 }, premium: { amount: 25000, days: 365 } };

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const plan = plans[body.plan];
  if (!plan || Number(body.amount) !== plan.amount) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  const paidWith = body.paidWith === "wallet" ? "wallet" : "transfer";
  const { data: store } = await supabase.from("stores").select("id,name,approval_status,verification_approved").eq("id", body.storeId).eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  if (!(await storeIsOperational(supabase, store.id))) return NextResponse.json({ error: "Your store is awaiting Sella verification. Billing is available after approval." }, { status: 403 });

  if (paidWith === "wallet") {
    const { data, error } = await supabase.rpc("pay_subscription_from_wallet", { p_store_id: store.id, p_plan: body.plan, p_amount: plan.amount });
    if (error) return NextResponse.json({ error: error.message || "Unable to pay from your Sella balance." }, { status: 400 });
    return NextResponse.json({ ...data, plan: body.plan, amount: plan.amount, message: "Your plan is active. The amount was deducted from your Sella seller balance." });
  }

  if (!(await providerConfigured())) return NextResponse.json({ error: "Plan payment is not configured yet. Sella Team needs to add the TransactPay public and encryption keys." }, { status: 503 });

  const planExpiry = new Date(Date.now() + plan.days * 86400000).toISOString();
  const paymentAccountExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await supabase.from("subscriptions").update({ status: "expired" }).eq("store_id", store.id).eq("status", "pending").lt("payment_account_expires_at", new Date().toISOString());
  const { data: subscription, error } = await supabase.from("subscriptions").insert({ store_id: store.id, plan: body.plan, amount: plan.amount, paid_with: "transfer", expires_at: planExpiry, payment_account_expires_at: paymentAccountExpiresAt, status: "pending", payment_reference: null }).select("id,plan,amount,expires_at,payment_account_expires_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  try {
    const account = await createVirtualAccount({ alias: `sella-plan-${subscription.id.slice(0, 8)}`, reference: subscription.id, narration: `Sella ${plan.days}-day ${body.plan} plan for ${store.name}` });
    const accountNumber = account.accountNumber || account.data?.account_number || account.data?.accountNumber;
    if (!accountNumber) throw new Error("TransactPay did not return an account number.");
    const accountName = account.accountName || account.data?.account_name || account.data?.accountName || null;
    const bankName = account.bank || account.data?.bank_name || account.data?.bank || null;
    const reference = account.accountReference || account.data?.accountReference || subscription.id;
    const { error: updateError } = await supabase.rpc("set_subscription_payment_account", { p_subscription_id: subscription.id, p_account_number: accountNumber, p_account_name: accountName, p_bank_name: bankName, p_payment_reference: reference });
    if (updateError) throw updateError;
    return NextResponse.json({ ...subscription, paymentAccountExpiresAt: subscription.payment_account_expires_at, accountNumber, accountName, bankName, reference, message: "Transfer the exact amount to this one-time account within 30 minutes. It expires automatically after that." });
  } catch (paymentError) {
    await supabase.from("subscriptions").delete().eq("id", subscription.id).eq("store_id", store.id);
    return NextResponse.json({ error: paymentError.message || "Unable to create the plan payment account." }, { status: 502 });
  }
}
