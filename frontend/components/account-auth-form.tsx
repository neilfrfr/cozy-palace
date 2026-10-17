"use client";
import { useActionState } from "react";
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
            <label className="full">
              Password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <label className="full">
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <p className="subtle full">
              Use 12–128 characters. A long, unique passphrase works well.
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
