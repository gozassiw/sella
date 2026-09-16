import { NextResponse } from "next/server";

export async function GET(request) {
  const response = NextResponse.redirect(new URL("/waiting", request.url));
  response.cookies.set({
    name: "sella_preview",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(process.env.NODE_ENV === "production" ? { domain: ".sella.com.ng" } : {}),
    maxAge: 0,
  });
  return response;
}
