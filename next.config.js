/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }] },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
};
module.exports = nextConfig;
