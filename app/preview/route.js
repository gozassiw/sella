import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function tokenMatches(candidate, expected) {
  if (!candidate || !expected) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function GET(request) {
  const configuredToken = process.env.SELLA_PREVIEW_ACCESS_TOKEN;
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!tokenMatches(token, configuredToken)) return new NextResponse("Not found", { status: 404 });

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
