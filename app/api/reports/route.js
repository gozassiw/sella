import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.storeId || !body.reason) return NextResponse.json({ error: "Store and reason are required." }, { status: 400 });
  const type = body.type === "store" ? "store" : body.type === "product" ? "product" : "order";
  const { data, error } = await supabase.from("reports").insert({ type, store_id: body.storeId, product_id: body.productId || null, order_id: body.orderId || null, reported_by: user.id, reason: body.reason, details: body.details || null }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
