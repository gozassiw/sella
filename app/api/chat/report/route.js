import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.messageId || !body.reason) return NextResponse.json({ error: "Choose a reason for reporting this message." }, { status: 400 });
  const { data: message, error: messageError } = await supabase.from("chat_messages").select("id,conversation_id,chat_conversations(store_id)").eq("id", body.messageId).maybeSingle();
  if (messageError || !message) return NextResponse.json({ error: "Message not found or chat access is locked." }, { status: 404 });
  const { data, error } = await supabase.from("reports").insert({ type: "message", store_id: message.chat_conversations.store_id, message_id: message.id, reported_by: user.id, reason: String(body.reason).slice(0, 180), details: body.details ? String(body.details).slice(0, 1000) : null }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
