import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function safeName(value) {
  return String(value || "image").replace(/[^a-zA-Z0-9._-]/g, "").slice(-60) || "image";
}

async function signedMessageRows(rows) {
  let admin = null;
  try { admin = createAdminClient(); } catch {}
  return Promise.all((rows || []).map(async (row) => {
    if (!row.image_path || !admin) return row;
    const { data } = await admin.storage.from("chat-media").createSignedUrl(row.image_path, 3600);
    return { ...row, image_url: data?.signedUrl || null };
  }));
}

async function currentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function buyerNames(threads) {
  const ids = [...new Set((threads || []).map((thread) => thread.buyer_id).filter(Boolean))];
  if (!ids.length) return new Map();
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("buyer_profiles").select("user_id,full_name").in("user_id", ids);
    return new Map((data || []).map((profile) => [profile.user_id, profile.full_name]));
  } catch {
    return new Map();
  }
}

function addInboxFields(threads, messages, user, names) {
  const byConversation = new Map();
  for (const message of messages || []) {
    const list = byConversation.get(message.conversation_id) || [];
    list.push(message);
    byConversation.set(message.conversation_id, list);
  }
  return (threads || []).map((thread) => {
    const list = (byConversation.get(thread.id) || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latest = list[0];
    const isSeller = thread.stores?.owner_id === user.id;
    const readAt = isSeller ? thread.seller_last_read_at : thread.buyer_last_read_at;
    const unreadCount = list.filter((message) => message.kind !== "system" && message.sender_id !== user.id && (!readAt || new Date(message.created_at) > new Date(readAt))).length;
    return {
      ...thread,
      participant_name: isSeller ? (names.get(thread.buyer_id) || "Buyer") : (thread.stores?.name || "Store"),
      last_message_preview: latest?.body || (latest?.kind === "image" ? "Sent an image." : latest ? "Order update" : "No messages yet"),
      unread_count: unreadCount,
    };
  }).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
}

export async function GET(request) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  if (conversationId) {
    const { data: conversation, error: conversationError } = await supabase.from("chat_conversations").select("id,store_id,buyer_id,created_at,last_message_at,buyer_last_read_at,seller_last_read_at,stores(id,name,slug,logo_url,owner_id)").eq("id", conversationId).maybeSingle();
    if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 400 });
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const { data: messages, error } = await supabase.from("chat_messages").select("id,conversation_id,sender_id,kind,body,image_path,order_id,system_event,created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(300);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ conversation, messages: await signedMessageRows(messages) });
  }
  const { data: threads, error } = await supabase.from("chat_conversations").select("id,store_id,buyer_id,created_at,last_message_at,buyer_last_read_at,seller_last_read_at,stores(id,name,slug,logo_url,owner_id)").order("last_message_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids = (threads || []).map((thread) => thread.id);
  let messages = [];
  if (ids.length) {
    const result = await supabase.from("chat_messages").select("id,conversation_id,sender_id,kind,body,created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(1000);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    messages = result.data || [];
  }
  return NextResponse.json({ threads: addInboxFields(threads, messages, user, await buyerNames(threads)) });
}

export async function POST(request) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const conversationId = String(form.get("conversationId") || "");
    const body = String(form.get("body") || "").trim();
    const file = form.get("image");
    if (!conversationId) return NextResponse.json({ error: "Conversation is required." }, { status: 400 });
    if (!body && !(file instanceof File)) return NextResponse.json({ error: "Write a message or attach an image." }, { status: 400 });
    if (body.length > 4000) return NextResponse.json({ error: "Messages must be 4,000 characters or less." }, { status: 400 });
    const { data: conversation, error: conversationError } = await supabase.from("chat_conversations").select("id,store_id,buyer_id,stores(owner_id,name)").eq("id", conversationId).maybeSingle();
    if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 400 });
    if (!conversation) return NextResponse.json({ error: "Conversation not found or chat is locked." }, { status: 404 });
    const recipientId = conversation.buyer_id === user.id ? conversation.stores?.owner_id : conversation.buyer_id;
    if (!recipientId) return NextResponse.json({ error: "Chat recipient not found." }, { status: 400 });
    let row;
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only image files can be sent in chat." }, { status: 400 });
      if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Chat images must be 5 MB or smaller." }, { status: 400 });
      const path = `${user.id}/${conversationId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const admin = createAdminClient();
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await admin.storage.from("chat-media").upload(path, bytes, { contentType: file.type, cacheControl: "3600", upsert: false });
      if (uploadError) return NextResponse.json({ error: "The image could not be uploaded." }, { status: 400 });
      const { data: inserted, error } = await supabase.from("chat_messages").insert({ conversation_id: conversationId, sender_id: user.id, kind: "image", body: body || null, image_path: path }).select("id,conversation_id,sender_id,kind,body,image_path,order_id,system_event,created_at").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      row = inserted;
    } else {
      const { data: inserted, error } = await supabase.from("chat_messages").insert({ conversation_id: conversationId, sender_id: user.id, kind: "text", body }).select("id,conversation_id,sender_id,kind,body,image_path,order_id,system_event,created_at").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      row = inserted;
    }
    await supabase.from("chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
    const link = conversation.buyer_id === user.id ? `/dashboard/messages?conversation=${conversationId}` : `/account/messages?conversation=${conversationId}`;
    const preview = body || "Sent an image.";
    const { error: notificationError } = await supabase.rpc("notify_chat_recipient", { p_conversation_id: conversationId, p_recipient_id: recipientId, p_body: preview, p_link: link });
    if (notificationError) console.error("Chat notification record failed", notificationError);
    let senderName = conversation.stores?.name || "Seller";
    if (conversation.buyer_id === user.id) {
      try {
        const admin = createAdminClient();
        const { data: profile } = await admin.from("buyer_profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        senderName = profile?.full_name?.trim() || "Buyer";
      } catch {}
    }
    await notifyUser({ userId: recipientId, type: "chat", title: `New message from ${senderName}`, body: preview, link, save: false });
    const [signed] = await signedMessageRows([row]);
    return NextResponse.json({ message: signed });
  }
  const body = await request.json().catch(() => ({}));
  if (body.action === "start" && body.storeId) {
    const { data, error } = await supabase.rpc("get_or_create_chat_conversation", { p_store_id: body.storeId });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ conversation: data });
  }
  if (body.action === "read" && body.conversationId) {
    const { data: conversation, error: conversationError } = await supabase.from("chat_conversations").select("id,buyer_id,stores(owner_id)").eq("id", body.conversationId).maybeSingle();
    if (conversationError || !conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const field = conversation.buyer_id === user.id ? "buyer_last_read_at" : conversation.stores?.owner_id === user.id ? "seller_last_read_at" : null;
    if (!field) return NextResponse.json({ error: "Chat access denied." }, { status: 403 });
    const { error } = await supabase.from("chat_conversations").update({ [field]: new Date().toISOString() }).eq("id", body.conversationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).eq("type", "chat").is("read_at", null);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unsupported chat action." }, { status: 400 });
}
