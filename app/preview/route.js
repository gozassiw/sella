import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function tokenMatches(candidate, expected) {
  if (!candidate || !expected) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(request) {
  const configuredToken = process.env.SELLA_PREVIEW_ACCESS_TOKEN;
  const token = new URL(request.url).searchParams.get("token") || "";
  let valid = tokenMatches(token, configuredToken);
  if (!valid && token) {
    try {
      const admin = createAdminClient();
      const { data: invite } = await admin.from("launch_preview_tokens").select("id").eq("token_hash", hashToken(token)).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
      valid = Boolean(invite);
      if (invite) await admin.from("launch_preview_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", invite.id);
    } catch (error) {
      console.error("Preview invite validation failed", error);
    }
  }
  if (!valid) return new NextResponse("Not found", { status: 404 });

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set({
    name: "sella_preview",
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(process.env.NODE_ENV === "production" ? { domain: ".sella.com.ng" } : {}),
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
