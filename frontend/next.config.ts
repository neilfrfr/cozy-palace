import type { NextConfig } from "next";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
const config: NextConfig = {
  poweredByHeader: false,
  // Admin-uploaded website photos live in the public Supabase Storage bucket.
  images: {
    remotePatterns: supabase
      ? [new URL("/storage/v1/object/public/site-images/**", supabase)]
      : [],
  },
  // Website photos are up to 5 MB; the default action body limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  // shortcut: no script/style CSP yet (Next inline scripts need nonces); this blocks framing and sniffing only.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default config;
