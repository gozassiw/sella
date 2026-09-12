import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured } from "@/lib/notifications";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { data, error } = await supabase.from("notifications").select("id,type,title,body,link,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notifications: data || [], pushConfigured: pushConfigured() });
}

export async function PATCH(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id);
  const { error } = body.id ? await query.eq("id", body.id) : await query.is("read_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.subscription?.endpoint) return NextResponse.json({ error: "A valid browser subscription is required." }, { status: 400 });
  const { error } = await supabase.from("push_subscriptions").upsert({ user_id: user.id, endpoint: body.subscription.endpoint, subscription: body.subscription, user_agent: request.headers.get("user-agent"), updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint || "");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
