import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Enter your email and password." }, 400);
  }

  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");
  if (!email || !password) {
    return json({ error: "Enter your email and password." }, 400);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return json({ error: "That email and password don't match. Try again." }, 401);
  }

  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", data.user.id).maybeSingle();
  return json({ ok: true, hasStore: Boolean(store) });
}
