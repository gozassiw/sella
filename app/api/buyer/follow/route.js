import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRUST_NOTICE_VERSION, verifyTrustNoticeNonce } from "@/lib/buyer-trust";

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please create a buyer account first." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const storeId = typeof body.storeId === "string" ? body.storeId : "";
    const following = body.follow !== false;
    if (!storeId) return NextResponse.json({ error: "Store is required." }, { status: 400 });
    if (!following) {
      const {data,error}=await createAdminClient().rpc("set_store_trust",{p_buyer_id:user.id,p_store_id:storeId,p_trusted:false,p_acknowledged:false,p_notice_version:null});
      if(error)return NextResponse.json({error:"Unable to remove this store."},{status:400});
      return NextResponse.json(data||{following:false});
    }
    const { data: store, error: storeError } = await supabase.from("stores").select("id").eq("id", storeId).eq("is_published", true).eq("approval_status", "approved").maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
    if (following && (body.acknowledged !== true || body.noticeVersion !== TRUST_NOTICE_VERSION || !verifyTrustNoticeNonce(body.noticeNonce, { userId: user.id, storeId: store.id }))) return NextResponse.json({ error: "Please review and acknowledge the Trust Store notice first." }, { status: 400 });
    // The migration grants this RPC only to service_role; browser clients cannot bypass the nonce.
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("set_store_trust", { p_buyer_id: user.id, p_store_id: store.id, p_trusted: following, p_acknowledged: following, p_notice_version: following ? TRUST_NOTICE_VERSION : null });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data || { following });
  } catch (error) {
    console.error("Trust Store update error", error);
    return NextResponse.json({ error: "Unable to update your trusted stores." }, { status: 400 });
  }
}
