import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" });
  const loginUrl = new URL("/login", request.url);
  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) loginUrl.searchParams.set("next", next);
  const response = NextResponse.redirect(loginUrl, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
