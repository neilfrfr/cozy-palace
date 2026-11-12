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
};
export default config;
