import "server-only";
import { adminConfigured } from "@/lib/supabase/admin";
/**
 * Visitor booking stays off without both Turnstile keys, so it never runs unprotected.
 * Cloudflare's test secrets (1x/2x/3x000…) accept a public dummy token, so Production refuses them.
 */
export const captchaConfigured = () =>
  !!process.env.TURNSTILE_SECRET_KEY &&
  !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
  !(
    process.env.VERCEL_ENV === "production" &&
    /^[123]x0{20,}/.test(process.env.TURNSTILE_SECRET_KEY)
  );
/** Cloudflare Turnstile check. Tokens are single-use and expire after five minutes. */
export async function verifyCaptcha(token: string, ip: string) {
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
    return res.ok && (await res.json())?.success === true;
  } catch {
    return false;
  }
}
/** Booking without an account needs the server key and a working CAPTCHA. */
export const visitorBookingEnabled = () =>
  adminConfigured() && captchaConfigured();
