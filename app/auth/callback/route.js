import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase sends people here after they click the email confirmation link.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next");
  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${nextPath && nextPath.startsWith("/") ? nextPath : "/onboarding"}`);
}
