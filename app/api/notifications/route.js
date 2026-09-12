import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyUser, pushConfigured } from "@/lib/notifications";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { data, error } = await supabase.from("notifications").select("id,type,title,body,link,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { count: subscriptionCount } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  return NextResponse.json({ notifications: data || [], pushConfigured: pushConfigured(), deviceRegistered: Number(subscriptionCount || 0) > 0 });
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
  if (body.test === true) {
    const title = "Sella test notification";
    const message = "Your Sella dashboard and phone notification connection is working.";
    const { error: recordError } = await supabase.rpc("create_notification", { p_user_id: user.id, p_type: "system", p_title: title, p_body: message, p_link: "/account/notifications" });
    if (recordError) return NextResponse.json({ error: recordError.message }, { status: 400 });
    const push = await notifyUser({ userId: user.id, type: "system", title, body: message, link: "/account/notifications", save: false });
    return NextResponse.json({ success: true, pushed: push.pushed || 0, pushConfigured: pushConfigured() });
  }
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
