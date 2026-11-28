"use client";
import { EmailInput } from "@/components/email-input";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { Turnstile } from "@/components/turnstile";
import { loginAction, staffLoginAction } from "@/app/login/actions";
export function LoginForm({
  next,
  configured,
  portal = "guest",
}: {
  next: string;
  configured: boolean;
  portal?: "guest" | "staff";
}) {
  const [state, action, pending] = useActionState(
    portal === "staff" ? staffLoginAction : loginAction,
    { message: "" },
  );
  const [accepted, setAccepted] = useState(false);
  // Supabase's CAPTCHA check; each token works once, so every submit gets a fresh widget.
  const [captcha, setCaptcha] = useState("");
  const needsCaptcha = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  // React resets the form after the action; the submitted email becomes the reset value.
  const [email, setEmail] = useState("");
  return (
    <form
      action={action}
      onSubmit={(event) => {
        setEmail(String(new FormData(event.currentTarget).get("email") ?? ""));
        setCaptcha("");
      }}
      className="form-panel account-form"
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="captchaToken" value={captcha} />
      <div className="form-grid">
        <label className="full">
          Email address
          <EmailInput
            name="email"
            defaultValue={email}
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <div className="full">
          <label htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <Link className="login-forgot" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
      </div>
      {portal === "guest" && (
        <label className="terms-check">
          <input
            type="checkbox"
            name="acceptTerms"
            // Uncontrolled: React's post-action form reset restores defaultChecked, which tracks the choice.
            defaultChecked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            I agree to the <Link href="/terms">Terms and Conditions</Link>
          </span>
        </label>
      )}
      {/* Each token works once: a fresh widget mounts when the answer arrives, not while it is pending. */}
      {needsCaptcha && pending ? (
        <div className="captcha" />
      ) : (
        <Turnstile action="sign_in" onToken={setCaptcha} />
      )}
      {state.message && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <button
        className="primary login-submit"
        disabled={
          pending ||
          !configured ||
          (portal === "guest" && !accepted) ||
          (needsCaptcha && !captcha)
        }
      >
        {pending ? "Signing in…" : "Log in"}
        <ArrowRight size={20} aria-hidden="true" />
      </button>
      {portal === "guest" && (
        <div className="login-foot">
          <p>
            New here?{" "}
            <Link href={"/register?next=" + encodeURIComponent(next)}>
              Create an Account
            </Link>
          </p>
          <p>
            Didn&apos;t get the email?{" "}
            <Link href="/forgot-password?mode=resend">Resend confirmation</Link>
          </p>
        </div>
      )}
    </form>
  );
}
