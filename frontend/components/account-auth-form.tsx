"use client";
import { EmailInput } from "@/components/email-input";
import { FieldInput } from "@/components/field-problem";
import { useActionState, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Turnstile } from "@/components/turnstile";
import {
  registerAction,
  emailAction,
  passwordAction,
} from "@/app/register/actions";
export function AccountAuthForm({
  mode,
  configured,
  next = "/reservations",
  reset = false,
}: {
  mode: "register" | "recover" | "resend" | "password";
  configured: boolean;
  next?: string;
  /** Arrived from a password-reset email, so the current password isn't asked. */
  reset?: boolean;
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
  // Supabase's CAPTCHA check guards every form here that sends email; each token works once.
  const [captcha, setCaptcha] = useState("");
  const needsCaptcha =
    mode !== "password" && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  // React resets the form after the action; the submitted values become the reset values.
  const [kept, setKept] = useState({ email: "", fullName: "" });
  return (
    <form
      action={submit}
      onSubmit={(event) => {
        const f = new FormData(event.currentTarget);
        setKept({
          email: String(f.get("email") ?? ""),
          fullName: String(f.get("fullName") ?? ""),
        });
        setCaptcha("");
      }}
      onInput={(event) => {
        // Flag a mismatch before submitting, so it shows under the field like other problems.
        const form = event.currentTarget;
        const password = form.elements.namedItem("password");
        const confirm = form.elements.namedItem("confirmPassword");
        if (password instanceof HTMLInputElement && confirm instanceof HTMLInputElement)
          confirm.setCustomValidity(
            confirm.value && confirm.value !== password.value
              ? "Passwords don't match."
              : "",
          );
      }}
      className="form-panel account-form"
    >
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="captchaToken" value={captcha} />
      <input type="hidden" name="next" value={next} />
      <div className="form-grid">
        {mode === "register" && (
          <label className="full">
            Full name
            <FieldInput
              name="fullName"
              defaultValue={kept.fullName}
              autoComplete="name"
              required
              maxLength={100}
            />
          </label>
        )}
        {mode !== "password" && (
          <label className="full">
            Email address
            <EmailInput
              name="email"
              defaultValue={kept.email}
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
        )}
        {mode === "password" && !reset && (
          <div className="full">
            <label htmlFor="currentPassword">Current password</label>
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              visibilityLabel="current password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </div>
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
                maxLength={25}
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
                maxLength={25}
              />
            </div>
            <p className="subtle full">
              Use 8–25 characters.
            </p>
          </>
        )}
      </div>
      {needsCaptcha &&
        // Each token works once: a fresh widget mounts when the answer arrives, not while it is pending.
        (pending ? (
          <div className="captcha" />
        ) : (
          <Turnstile
            action={mode === "register" ? "sign_up" : "email_link"}
            onToken={setCaptcha}
          />
        ))}
      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          className={"notice " + (state.success ? "" : "error")}
        >
          {state.message}
        </p>
      )}
      <button
        className="primary"
        disabled={pending || !configured || (needsCaptcha && !captcha)}
      >
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
