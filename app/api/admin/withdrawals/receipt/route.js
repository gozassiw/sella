import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

function safeName(value) {
  return String(value || "receipt").replace(/[^a-zA-Z0-9._-]/g, "").slice(-80) || "receipt";
}

export async function POST(request) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  const { data: authorized } = user ? await auth.rpc("is_platform_admin") : { data: false };
  if (!user || authorized !== true) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  try {
    const form = await request.formData();
    const withdrawalId = String(form.get("withdrawalId") || "");
    const file = form.get("receipt");
    if (!withdrawalId || !(file instanceof File)) return NextResponse.json({ error: "A withdrawal and receipt file are required." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) return NextResponse.json({ error: "Receipt must be 10 MB or smaller." }, { status: 400 });
    if (!(file.type.startsWith("image/") || file.type === "application/pdf")) return NextResponse.json({ error: "Upload an image or PDF receipt." }, { status: 400 });

    const admin = createAdminClient();
    const { data: withdrawal, error: withdrawalError } = await admin.from("withdrawals").select("id,status,store_id,stores(owner_id,name)").eq("id", withdrawalId).maybeSingle();
    if (withdrawalError) throw withdrawalError;
    if (!withdrawal) return NextResponse.json({ error: "Withdrawal request not found." }, { status: 404 });
    if (!["paid", "sent"].includes(withdrawal.status)) return NextResponse.json({ error: "Mark the withdrawal paid before uploading a receipt." }, { status: 400 });

    const path = `${withdrawalId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error: uploadError } = await admin.storage.from("withdrawal-receipts").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { error: attachError } = await auth.rpc("admin_attach_withdrawal_receipt", { p_withdrawal_id: withdrawalId, p_receipt_path: path, p_receipt_name: file.name });
    if (attachError) throw attachError;

    if (withdrawal.stores?.owner_id) {
      await notifyUser({ userId: withdrawal.stores.owner_id, type: "withdrawal", title: "Withdrawal receipt available", body: "Sella has uploaded the payment receipt for your withdrawal.", link: `/dashboard/wallet/withdrawals/${withdrawalId}`, save: false });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Receipt upload failed." }, { status: 400 });
  }
}
