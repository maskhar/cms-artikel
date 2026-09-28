import type { NextConfig } from "next";

// carubra.com adalah domain Supabase self-hosted (lihat NEXT_PUBLIC_SUPABASE_URL) —
// dipakai untuk images.remotePatterns. CSP TIDAK di sini — dia butuh nonce unik
// per request (script-src 'nonce-...' 'strict-dynamic') jadi dibangun & dipasang
// di src/proxy.ts, bukan sebagai header statis next.config.ts.
const supabaseHost = "supabase.carubra.com";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
