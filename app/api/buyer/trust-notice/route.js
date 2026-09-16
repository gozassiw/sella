import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { issueTrustNoticeNonce, TRUST_NOTICE_VERSION } from "@/lib/buyer-trust";

export async function GET(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please create a buyer account first." }, { status: 401 });
    const storeId = new URL(request.url).searchParams.get("storeId");
    if (!storeId) return NextResponse.json({ error: "Store is required." }, { status: 400 });
    const { data: store, error } = await supabase.from("stores").select("id,name,logo_url,seller_code").eq("id", storeId).eq("is_published", true).eq("approval_status", "approved").maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
    return NextResponse.json({ noticeVersion: TRUST_NOTICE_VERSION, nonce: issueTrustNoticeNonce({ userId: user.id, storeId: store.id }), store: { id: store.id, name: store.name, logoUrl: store.logo_url || null, sellerCode: store.seller_code || "Unavailable" } });
  } catch (error) {
    console.error("Trust notice error", error);
    return NextResponse.json({ error: "Unable to load the Trust Store confirmation." }, { status: 400 });
  }
}
