import "server-only";

/** The Turnstile token a sign-in or email form posted; Supabase checks it once Auth CAPTCHA is on. */
export const captchaToken = (form: FormData) => {
  const t = String(form.get("captchaToken") ?? "");
  return t && t.length <= 2048 ? t : undefined;
};

/** What to tell the user about a Supabase Auth error. */
export function authFailure(
  error: { status?: number; code?: string },
  fallback = "We could not sign you in. Check your email and password.",
) {
  if (error.code === "captcha_failed")
    return "The security check expired or failed. Complete it again, then retry.";
  if (error.status === 429)
    return "Too many attempts right now. Wait a few minutes, then try again.";
  return fallback;
}
