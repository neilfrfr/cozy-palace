"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/login/actions";
export function LoginForm({
  next,
  configured,
}: {
  next: string;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(loginAction, { message: "" });
  return (
    <form action={action} className="form-panel">
      <input type="hidden" name="next" value={next} />
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
        <label className="full">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
      </div>
      {state.message && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={pending || !configured}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <p className="subtle">
        For this prototype, use a test account supplied by the project team.
        Public registration and recovery are scheduled for the launch release.
      </p>
    </form>
  );
}
