import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in as a buyer first." }, { status: 401 });
  const { data: held } = await supabase.rpc("is_account_held", { p_user_id: user.id });
  if (held) return NextResponse.json({ error: "Your account is on hold while Sella Team reviews it." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) return NextResponse.json({ error: "Enter the seller’s 8-character store ID." }, { status: 400 });
  const { data, error } = await supabase.rpc("resolve_store_access_code", { p_code: code });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const store = Array.isArray(data) ? data[0] : data;
  if (!store?.slug) return NextResponse.json({ error: "Store not found. Check the ID with the seller." }, { status: 404 });
  return NextResponse.json({ slug: store.slug, storeId: store.store_id, storeName: store.store_name });
}
