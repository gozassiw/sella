import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(new URL("/login?next=/admin", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
