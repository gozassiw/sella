import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export async function POST(request) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const admin = createAdminClient();
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "store_trust") {
      const { error } = await admin.from("stores").update({ trusted: Boolean(body.trusted) }).eq("id", body.storeId);
      if (error) throw error;
    } else if (body.action === "withdrawal_status") {
      const { error } = await admin.from("withdrawals").update({ status: body.status, note: body.note || null, processed_at: body.status === "sent" ? new Date().toISOString() : null }).eq("id", body.withdrawalId);
      if (error) throw error;
    } else if (body.action === "report_status") {
      const { error } = await admin.from("reports").update({ status: body.status || "resolved" }).eq("id", body.reportId);
      if (error) throw error;
    } else if (body.action === "setting") {
      const { error } = await admin.from("app_settings").upsert({ key: body.key, value: body.value ?? {}, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else if (body.action === "verification") {
      const { error } = await admin.from("stores").update({ verification_approved: Boolean(body.approved), nin_status: body.approved ? "verified" : "pending" }).eq("id", body.storeId);
      if (error) throw error;
    } else return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
    await admin.from("admin_audit_logs").insert({ admin_user_id: user.id, action: body.action, entity_id: body.storeId || body.withdrawalId || body.reportId || null, details: body });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Admin operation failed." }, { status: 400 });
  }
}
