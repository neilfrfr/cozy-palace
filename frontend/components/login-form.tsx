"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
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
          className="primary"
          disabled={
            pending || !configured || !accepted || (needsCaptcha && !captcha)
          }
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <p className="subtle login-register-link">
        New here?{" "}
        <a href={"/register?next=" + encodeURIComponent(next)}>
          Create an Account
        </a>
      </p>
      <p className="subtle login-staff-note">
        Team members: <a href="/staff/register">Staff Registration</a> using the
        email approved by your administrator.
      </p>
      <p>
        <a href="/forgot-password">Forgot password?</a> ·{" "}
        <a href="/forgot-password?mode=resend">Resend confirmation</a>
      </p>
    </form>
  );
}
