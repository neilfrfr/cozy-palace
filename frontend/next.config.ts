import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Booking links carry a secret token; never leak it to other sites.
  headers: async () => [
    {
      source: "/stay/:token",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    },
  ],
};
export default config;
