export function getSupabaseCookieOptions() {
  const configuredDomain = String(process.env.NEXT_PUBLIC_STORE_DOMAIN || (process.env.NODE_ENV === "production" ? "sella.com.ng" : ""))
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .toLowerCase();

  const isProductionDomain = configuredDomain && configuredDomain.includes(".") && !configuredDomain.includes("localhost");
  return isProductionDomain
    ? { domain: `.${configuredDomain}`, path: "/", sameSite: "lax", secure: true }
    : { path: "/", sameSite: "lax" };
}

export function getSupabaseCookieDomain() {
  const options = getSupabaseCookieOptions();
  return options.domain;
}
