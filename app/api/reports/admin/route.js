import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { isPlatformAdmin } from "@/lib/report-server";
import { normalizeReportStatus, cleanReportText, isUuid } from "@/lib/report-safety";

export async function GET() {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!(await isPlatformAdmin(auth, user))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { data, error } = await auth.from("reports").select("id,case_ref,type,store_id,order_id,reported_by,buyer_id,reason,report_reason,details,status,created_at,updated_at,stores(id,name,slug,owner_id),orders(id,order_number,total)").order("created_at", { ascending: false }).limit(250);
  if (error) return NextResponse.json({ error: "Reports could not be loaded." }, { status: 400 });
  return NextResponse.json({ reports: data || [] });
}

export async function POST(request) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!(await isPlatformAdmin(auth, user))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const reportId = String(body.reportId || "");
  const action = String(body.action || "");
  if (!isUuid(reportId)) return NextResponse.json({ error: "A valid report is required." }, { status: 400 });
  const allowedActions = new Set(["status", "internal_note", "seller_request", "admin_action"]);
  if (!allowedActions.has(action)) return NextResponse.json({ error: "Unsupported report action." }, { status: 400 });
  const status = action === "status" ? normalizeReportStatus(body.status) : null;
  if (action === "status" && !status) return NextResponse.json({ error: "Choose a valid report status." }, { status: 400 });
  const note = cleanReportText(body.body, 5000) || null;
  if (["internal_note", "seller_request", "admin_action"].includes(action) && !note) return NextResponse.json({ error: "A note or action detail is required." }, { status: 400 });
  const { data, error } = await auth.rpc("report_admin_action", { p_report_id: reportId, p_action: action, p_status: status, p_body: note, p_seller_visible: Boolean(body.sellerVisible) });
  if (error) return NextResponse.json({ error: error.message || "Report action failed." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data: report } = await admin.from("reports").select("id,case_ref,buyer_id,status,stores(owner_id)").eq("id",reportId).single();
    if(action === "seller_request" && report?.stores?.owner_id) await notifyUser({userId:report.stores.owner_id,type:"report",title:`Sella case ${report.case_ref}: response requested`,body:"Sella has requested your response. Please review the question in Reports & Safety.",link:`/dashboard/reports?case=${reportId}`});
    if(["status","seller_request"].includes(action) && report?.buyer_id) await notifyUser({userId:report.buyer_id,type:"report",title:"Report status updated",body:`Your report ${report.case_ref} is now ${report.status}.`,link:`/account/reports/${reportId}`,save:false});
  } catch { /* Case and in-app status history were saved transactionally; push is best-effort. */ }
  return NextResponse.json(data || { success: true });
}
