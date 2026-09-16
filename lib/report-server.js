import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPlatformAdmins, notifyUser } from "@/lib/notifications";
import { isUuid, cleanReportText, normalizeReportReason, normalizeReportStatus, statusUpdateText } from "@/lib/report-safety";

export async function getReportAuth() {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  return { auth, user };
}

export async function isPlatformAdmin(auth, user) {
  if (!user) return false;
  const { data } = await auth.rpc("is_platform_admin");
  return data === true;
}

export async function getReportForUser(auth, reportId, user, { includeAdmin = false } = {}) {
  if (!isUuid(reportId) || !user) return null;
  const { data: report, error } = await auth.from("reports").select("id,case_ref,type,store_id,order_id,reported_by,buyer_id,reason,report_reason,details,status,created_at,updated_at,closed_at,stores(id,name,slug,owner_id),orders(id,order_number,total)").eq("id", reportId).maybeSingle();
  if (error || !report) return null;
  const admin = includeAdmin && await isPlatformAdmin(auth, user);
  const buyer = report.buyer_id === user.id || (!report.buyer_id && report.reported_by === user.id);
  const seller = false; // Seller context is served only through the filtered seller-case endpoint.
  if (!admin && !buyer) return null;
  return { report, admin, buyer, seller };
}

export function validateReportTarget(body) {
  const storeId = String(body.storeId || "");
  const orderId = body.orderId ? String(body.orderId) : null;
  const productId = body.productId ? String(body.productId) : null;
  const type = ["store", "product", "order"].includes(body.type) ? body.type : "order";
  const reason = normalizeReportReason(body.reportReason || body.reason);
  if (!isUuid(storeId)) return { error: "A valid store is required." };
  if (orderId && !isUuid(orderId)) return { error: "The order reference is invalid." };
  if (productId && !isUuid(productId)) return { error: "The product reference is invalid." };
  if (type === "order" && !orderId) return { error: "An order is required for an order report." };
  if (type === "product" && !productId) return { error: "A product is required for a product report." };
  if (!reason) return { error: "Choose one of the available report reasons." };
  return { storeId, orderId, productId, type, reason, details: cleanReportText(body.details, 5000) || null };
}

export async function validateBuyerTarget(auth, user, { storeId, orderId, productId, type }) {
  // A paused/unpublished store may still need investigation. Read only known-ID
  // context server-side; never require a complainant to trust an accused store.
  const { data: store } = await createAdminClient().from("stores").select("id,name,slug,owner_id").eq("id", storeId).maybeSingle();
  if (!store) return { error: "Store not found." };
  if (orderId) {
    const { data: order } = await auth.from("orders").select("id,store_id,buyer_id,order_number,total").eq("id", orderId).maybeSingle();
    if (!order || order.store_id !== storeId || order.buyer_id !== user.id) return { error: "That order is not linked to your account or this store." };
    return { store, order };
  }
  if (type === "product" && productId) {
    const { data: product } = await auth.from("products").select("id,store_id").eq("id", productId).maybeSingle();
    if (!product || product.store_id !== storeId) return { error: "That product is not linked to this store." };
  }
  return { store, order: null };
}

export async function notifyReportCreated({ report, store, buyerId }) {
  const title = `New report ${report.case_ref}`;
  const body = `${store?.name || "A store"} has a new buyer-safety report for review.`;
  try { await notifyPlatformAdmins({ type: "report", title, body, link: "/admin?section=reports" }); } catch (error) { console.error("Report admin notification failed", error); }
  return { buyerId };
}

export async function notifyReportStatus({ report, status }) {
  if (!report?.buyer_id) return;
  try { await notifyUser({ userId: report.buyer_id, type: "report", title: "Report status updated", body: statusUpdateText(status, report.case_ref), link: `/account/reports/${report.id}`, save: false }); } catch (error) { console.error("Report status notification failed", error); }
}

export async function safeAdminClient() {
  try { return createAdminClient(); } catch (error) { throw new Error("Server storage is not configured."); }
}

export function isValidReportId(value) { return isUuid(value); }
export function normalizeAdminStatus(value) { return normalizeReportStatus(value); }
