import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.accepted !== true) return NextResponse.json({ error: "Please confirm the commission acknowledgement." }, { status: 400 });

  const { data: store, error: storeError } = await supabase.from("stores").select("id,approval_status,commission_acknowledged_at").eq("owner_id", user.id).maybeSingle();
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 400 });
  if (!store) return NextResponse.json({ error: "Seller store not found." }, { status: 404 });
  if (store.approval_status !== "approved") return NextResponse.json({ error: "This acknowledgement is available after Sella verifies your store." }, { status: 403 });
  if (store.commission_acknowledged_at) return NextResponse.json({ success: true, alreadyAcknowledged: true });

  const { error } = await supabase.from("stores").update({ commission_acknowledged_at: new Date().toISOString() }).eq("id", store.id).eq("owner_id", user.id).eq("approval_status", "approved");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
