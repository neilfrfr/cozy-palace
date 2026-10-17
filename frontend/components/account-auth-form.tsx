"use client";
import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import {
  registerAction,
  emailAction,
  passwordAction,
} from "@/app/register/actions";
export function AccountAuthForm({
  mode,
  configured,
  next = "/reservations",
}: {
  mode: "register" | "recover" | "resend" | "password";
  configured: boolean;
  next?: string;
}) {
  const action =
    mode === "register"
      ? registerAction
      : mode === "password"
        ? passwordAction
        : emailAction;
  const [state, submit, pending] = useActionState(action, {
    message: "",
    success: false,
  });
  return (
    <form action={submit} className="form-panel">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      <div className="form-grid">
        {mode === "register" && (
          <label className="full">
            Full name
            <input
              name="fullName"
              autoComplete="name"
              required
              maxLength={100}
            />
          </label>
        )}
        {mode !== "password" && (
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
        )}
        {(mode === "register" || mode === "password") && (
          <>
            <div className="full">
              <label htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </div>
            <div className="full">
              <label htmlFor="confirmPassword">Confirm password</label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                visibilityLabel="confirm password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </div>
            <p className="subtle full">
              Use 8–128 characters. A long, unique passphrase works well.
            </p>
          </>
        )}
      </div>
      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          className={"notice " + (state.success ? "" : "error")}
        >
          {state.message}
        </p>
      )}
      <button className="primary" disabled={pending || !configured}>
        {pending
          ? "Please wait…"
          : mode === "register"
            ? "Create account"
            : mode === "password"
              ? "Update password"
              : mode === "recover"
                ? "Send recovery link"
                : "Resend confirmation"}
      </button>
    </form>
  );
}
