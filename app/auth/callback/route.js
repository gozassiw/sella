import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase sends people here after they click the email confirmation link.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next");
  const supabase = createClient();
  if (code) await supabase.auth.exchangeCodeForSession(code);
  let destination = nextPath && nextPath.startsWith("/") ? nextPath : null;
  if (!destination) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: store } = user ? await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle() : { data: null };
    destination = store ? "/dashboard" : "/account";
  }
  return NextResponse.redirect(`${origin}${destination}`);
}
