import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveTransactPayConfig } from "@/lib/payments/transactpay";
import { notifyUser } from "@/lib/notifications";

export async function POST(request) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  const { data: authorized } = user ? await auth.rpc("is_platform_admin") : { data: false };
  if (!user || authorized !== true) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "setting") {
      const definitions = {
        deposit_fee_rate: { field: "rate", max: 100 },
        bank_transfer_fee_rate: { field: "rate", max: 100 },
        commission_rate: { field: "rate", max: 100 },
        withdrawal_fee: { field: "amount", max: 1000000 },
      };
      const definition = definitions[body.key];
      const field = definition?.field;
      const numeric = field ? Number(body.value?.[field]) : NaN;
      if (!definition || !Number.isFinite(numeric) || numeric < 0 || numeric > definition.max) return NextResponse.json({ error: "Enter a valid fee value." }, { status: 400 });
      body.value = { [field]: numeric };
    }
    if (body.action === "payment_config") {
      await saveTransactPayConfig({ baseUrl: body.baseUrl, publicKey: body.publicKey, secretKey: body.secretKey, encryptionKey: body.encryptionKey });
    } else {
      const withdrawal = body.action === "withdrawal_status" ? (await auth.from("withdrawals").select("amount,store_id,stores(owner_id,name)").eq("id", body.withdrawalId).maybeSingle()).data : null;
      const { data: actionResult, error } = await auth.rpc("admin_apply_action", { p_action: body.action, p_payload: body });
      if (error) throw error;
      if (actionResult?.user_id && body.action === "account_hold") await notifyUser({ userId: actionResult.user_id, type: "account_hold", title: body.held === false ? "Account released" : "Account placed on hold", body: body.held === false ? "Your Sella account is active again." : (body.reason || "Sella Team has paused activity on this account."), link: body.held === false ? "/account" : "/account/profile", save: false });
      if (actionResult?.user_id && body.action === "store_approval") await notifyUser({ userId: actionResult.user_id, type: "verification", title: body.approvalStatus === "approved" ? "Store approved" : "Update requested for your store", body: body.approvalStatus === "approved" ? "Your store is live and your 10-day trial with up to 15 products has started." : (body.reason || "Please update your seller details and resubmit for verification."), link: "/dashboard", save: false });
      if (body.action === "withdrawal_status") {
        const sent = body.status === "sent";
        const { error: withdrawalNotificationError } = await auth.rpc("notify_withdrawal_owner", { p_withdrawal_id: body.withdrawalId, p_status: body.status });
        if (withdrawalNotificationError) console.error("Withdrawal notification record failed", withdrawalNotificationError);
        if (withdrawal?.stores?.owner_id) await notifyUser({ userId: withdrawal.stores.owner_id, type: "withdrawal", title: sent ? "Withdrawal processed" : "Withdrawal rejected", body: sent ? `Your ${Number(withdrawal.amount || 0).toLocaleString("en-NG", { style: "currency", currency: "NGN" })} withdrawal has been processed.` : "Your withdrawal request was rejected by Sella Team. Check your seller wallet for details.", link: "/dashboard/wallet", save: false });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Admin operation failed." }, { status: 400 });
  }
}
