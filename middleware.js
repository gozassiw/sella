import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseCookieOptions } from "./lib/supabase/cookie-options";

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login" || path === "/signup";
  const configuredDomain = String(process.env.NEXT_PUBLIC_STORE_DOMAIN || (process.env.NODE_ENV === "production" ? "sella.com.ng" : "")).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const cookieOptions = getSupabaseCookieOptions();
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() || "";
  const baseHost = configuredDomain.toLowerCase();
  const subdomain = configuredDomain && host.endsWith(`.${baseHost}`) ? host.slice(0, -(baseHost.length + 1)) : "";
  const reservedSubdomains = new Set(["www", "app", "api"]);
  const isAppAsset = path === "/sw.js" || path === "/manifest.webmanifest" || path === "/robots.txt" || path.startsWith("/brand/");

  const internalStorePath = `/s/${subdomain}`;
  const isMatchingInternalStorePath = path === internalStorePath || path.startsWith(`${internalStorePath}/`);
  const isSharedBuyerPath = path.startsWith("/cart") || path.startsWith("/checkout") || path.startsWith("/buyer") || path.startsWith("/open") || path.startsWith("/terms") || path.startsWith("/privacy");

  function bridgeSessionCookies(response) {
    if (!cookieOptions.domain) return response;
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) response.cookies.set(cookie.name, cookie.value, cookieOptions);
    }
    return response;
  }

  if (subdomain && !reservedSubdomains.has(subdomain) && !isAppAsset && !isSharedBuyerPath && !path.startsWith("/_next") && !path.startsWith("/api") && !path.startsWith("/auth") && !path.startsWith("/login") && !path.startsWith("/signup") && !path.startsWith("/account") && !path.startsWith("/dashboard") && !path.startsWith("/onboarding") && (!path.startsWith("/s/") || isMatchingInternalStorePath)) {
    const url = request.nextUrl.clone();
    url.pathname = path === "/" ? `/s/${subdomain}` : isMatchingInternalStorePath ? path : `/s/${subdomain}${path}`;
    return bridgeSessionCookies(NextResponse.rewrite(url));
  }

  // Protected layouts and server pages own their auth checks. Keeping this
  // middleware to auth-page redirects avoids an extra Supabase round trip on
  // every buyer, seller, and admin navigation.
  if (!isAuthPage) return bridgeSessionCookies(NextResponse.next());

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions,
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, ...cookieOptions }));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const url = request.nextUrl.clone();
    const requestedNext = request.nextUrl.searchParams.get("next");
    if (requestedNext && requestedNext.startsWith("/")) url.pathname = requestedNext;
    else {
      const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
      url.pathname = store ? "/dashboard" : "/account";
    }
    url.search = "";
    return bridgeSessionCookies(NextResponse.redirect(url));
  }
  return bridgeSessionCookies(response);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
