import "server-only";
import { adminConfigured } from "@/lib/supabase/admin";
/** Cloudflare's always-pass/fail test secrets (1x/2x/3x000…). They accept a public dummy token. */
const testSecret = (s: string) => /^[123]x0{20,}/.test(s);
/** Frontend hostnames this deployment accepts tokens from, e.g. "cozy-palace-six.vercel.app". */
const hostnames = () =>
  new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  );
/**
 * Visitor booking stays off without both Turnstile keys and the hostname list, so it never runs
 * unprotected. Production refuses test secrets; locally they skip the hostname list.
 */
export function captchaConfigured() {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return false;
  if (testSecret(secret)) return process.env.VERCEL_ENV !== "production";
  return hostnames().size > 0;
}
/** Widget actions, one per protected form; the server checks the token came from that form. */
export type CaptchaAction = "book_room" | "book_table";
/** Cloudflare Turnstile check. Tokens are single-use and expire after five minutes. */
export async function verifyCaptcha(
  token: string,
  ip: string,
  action: CaptchaAction,
) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token || token.length > 2048) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return false;
    const result = await res.json();
    if (result?.success !== true) return false;
    // Test secrets answer with a placeholder action and hostname.
    if (testSecret(secret)) return true;
    return result.action === action && hostnames().has(result.hostname);
  } catch {
    return false;
  }
}
/** Booking without an account needs the server key and a working CAPTCHA. */
export const visitorBookingEnabled = () =>
  adminConfigured() && captchaConfigured();
