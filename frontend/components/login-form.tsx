"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { Turnstile } from "@/components/turnstile";
import { loginAction } from "@/app/login/actions";
export function LoginForm({
  next,
  configured,
}: {
  next: string;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(loginAction, { message: "" });
  const [accepted, setAccepted] = useState(false);
  // Supabase's CAPTCHA check; each token works once, so every submit gets a fresh widget.
  const [captcha, setCaptcha] = useState("");
  const [round, setRound] = useState(0);
  const needsCaptcha = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return (
    <form
      action={action}
      onSubmit={() => {
        setCaptcha("");
        setRound((n) => n + 1);
      }}
      className="form-panel"
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="captchaToken" value={captcha} />
      <div className="form-grid">
        <label className="full">
          Email address
          <input
            name="email"
            type="email"
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
        </div>
      </div>
      <label className="terms-check">
        <input
          type="checkbox"
          name="acceptTerms"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>
          I agree to the <Link href="/terms">Terms and Conditions</Link>
        </span>
      </label>
      <Turnstile key={round} action="sign_in" onToken={setCaptcha} />
      {state.message && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <div className="actions">
        <button
          className="primary login-submit"
          disabled={
            pending || !configured || !accepted || (needsCaptcha && !captcha)
          }
        >
          {pending ? "Signing in…" : "Log in"}
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
      <p className="subtle login-register-link">
        New here?{" "}
        <Link href={"/register?next=" + encodeURIComponent(next)}>
          Create an Account
        </Link>
      </p>
      <p className="subtle login-staff-note">
        Team members: <Link href="/staff/register">Staff Registration</Link>{" "}
        using the email approved by your administrator.
      </p>
      <p>
        <Link href="/forgot-password">Forgot password?</Link> ·{" "}
        <Link href="/forgot-password?mode=resend">Resend confirmation</Link>
      </p>
    </form>
  );
}
