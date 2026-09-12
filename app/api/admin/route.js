import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { saveTransactPayConfig } from "@/lib/payments/transactpay";

export async function POST(request) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  try {
    const admin = createAdminClient();
    if (body.action === "store_trust") {
      const { error } = await admin.from("stores").update({ trusted: Boolean(body.trusted) }).eq("id", body.storeId); if (error) throw error;
    } else if (body.action === "withdrawal_status") {
      const { error } = await admin.from("withdrawals").update({ status: body.status, note: body.note || null, processed_at: body.status === "sent" ? new Date().toISOString() : null }).eq("id", body.withdrawalId); if (error) throw error;
    } else if (body.action === "report_status") {
      const { error } = await admin.from("reports").update({ status: body.status || "resolved" }).eq("id", body.reportId); if (error) throw error;
    } else if (body.action === "setting") {
      const { error } = await admin.from("app_settings").upsert({ key: body.key, value: body.value ?? {}, updated_at: new Date().toISOString() }); if (error) throw error;
    } else if (body.action === "verification") {
      const { error } = await admin.from("stores").update({ verification_approved: Boolean(body.approved), nin_status: body.approved ? "verified" : "pending" }).eq("id", body.storeId); if (error) throw error;
    } else if (body.action === "store_approval") {
      const approved = body.approvalStatus === "approved";
      const now = new Date().toISOString();
      const changes = { approval_status: approved ? "approved" : "rejected", is_published: approved, approved_at: approved ? now : null, rejected_at: approved ? null : now, rejection_reason: approved ? null : (body.reason || "Please update your store details and resubmit for review."), trial_starts_at: approved ? now : null, ...(approved ? { trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString() } : {}) };
      const { error } = await admin.from("stores").update(changes).eq("id", body.storeId); if (error) throw error;
    } else if (body.action === "payment_config") {
      await saveTransactPayConfig({ baseUrl: body.baseUrl, publicKey: body.publicKey, secretKey: body.secretKey, encryptionKey: body.encryptionKey });
    } else return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
    await admin.from("admin_audit_logs").insert({ admin_user_id: user.id, action: body.action, entity: body.entity || null, entity_id: body.storeId || body.withdrawalId || body.reportId || null, details: { ...body, publicKey: undefined, secretKey: undefined, encryptionKey: undefined } });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error.message || "Admin operation failed." }, { status: 400 }); }
}
