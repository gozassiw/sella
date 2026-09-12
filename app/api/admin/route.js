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
    if (body.action === "payment_config") {
      await saveTransactPayConfig({ baseUrl: body.baseUrl, publicKey: body.publicKey, secretKey: body.secretKey, encryptionKey: body.encryptionKey });
    } else {
      const { data: actionResult, error } = await auth.rpc("admin_apply_action", { p_action: body.action, p_payload: body });
      if (error) throw error;
      if (actionResult?.user_id && body.action === "account_hold") await notifyUser({ userId: actionResult.user_id, type: "account_hold", title: body.held === false ? "Account released" : "Account placed on hold", body: body.held === false ? "Your Sella account is active again." : (body.reason || "Sella Team has paused activity on this account."), link: body.held === false ? "/account" : "/account/profile", save: false });
      if (actionResult?.user_id && body.action === "store_approval") await notifyUser({ userId: actionResult.user_id, type: "verification", title: body.approvalStatus === "approved" ? "Store approved" : "Update requested for your store", body: body.approvalStatus === "approved" ? "Your store is live and your 10-day trial has started." : (body.reason || "Please update your seller details and resubmit for verification."), link: "/dashboard", save: false });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Admin operation failed." }, { status: 400 });
  }
}
