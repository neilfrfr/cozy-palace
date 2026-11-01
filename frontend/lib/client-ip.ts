import "server-only";
import { headers } from "next/headers";
/** The visitor's IP for rate limits. Vercel sets x-real-ip itself; the forwarded chain is the local fallback. */
export async function clientIp() {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
