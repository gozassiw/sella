import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json({ error: "That email and password don't match. Try again." }, { status: 401 });
  }

  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", data.user.id).maybeSingle();
  return NextResponse.json({ ok: true, hasStore: Boolean(store) });
}
