import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeIsOperational } from "@/lib/store";

const plans = { quarterly: { amount: 5000, days: 90 }, biannual: { amount: 9000, days: 180 }, yearly: { amount: 15000, days: 365 } };

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const plan = plans[body.plan];
  if (!plan || Number(body.amount) !== plan.amount) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  const { data: store } = await supabase.from("stores").select("id").eq("id", body.storeId).eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  if (!(await storeIsOperational(supabase, store.id))) return NextResponse.json({ error: "Your store is awaiting Sella verification. Billing is available after approval." }, { status: 403 });
  const expires = new Date(Date.now() + plan.days * 86400000).toISOString();
  const { data, error } = await supabase.from("subscriptions").insert({ store_id: store.id, plan: body.plan, amount: plan.amount, paid_with: "transfer", expires_at: expires, status: "pending" }).select("id,plan,amount,expires_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ...data, message: "Transfer instructions will be added when billing payments are connected." });
}
