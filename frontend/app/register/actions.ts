"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
import {
  signupSchema,
  emailSchema,
  passwordSchema,
} from "@/lib/accounts/schema";
import { siteOrigin } from "@/lib/accounts/site-url";
import { requireIdentity } from "@/lib/auth/authorize";
export type AccountState = { message: string; success: boolean };
const unavailable = {
  message: "Account services are not connected yet. Please try again later.",
  success: false,
};
export async function registerAction(
  _state: AccountState,
  form: FormData,
): Promise<AccountState> {
  const p = signupSchema.safeParse(
    Object.fromEntries(
      ["fullName", "email", "password", "confirmPassword"].map((k) => [
        k,
        form.get(k),
      ]),
    ),
  );
  if (!p.success)
    return {
      message:
        "Enter your name, a valid email, and matching passwords of 12–128 characters.",
      success: false,
    };
  const origin = siteOrigin();
  if (!isConfigured() || !origin) return unavailable;
  const db = await createClient();
  const next = safeRedirect(String(form.get("next") || ""));
  const { data, error } = await db.auth.signUp({
    email: p.data.email,
    password: p.data.password,
    options: {
      data: { full_name: p.data.fullName },
      emailRedirectTo:
        origin + "/auth/confirm?next=" + encodeURIComponent(next),
    },
  });
  if (error)
    return {
      message:
        "We could not complete registration. Check your details or try again later.",
      success: false,
    };
  if (data.session) {
    await db.rpc("accept_staff_invitation");
    redirect(next);
  }
  return {
    message:
      "If registration is available for this email, a confirmation link has been sent. Check your inbox and spam folder before signing in.",
    success: true,
  };
}
export async function emailAction(
  _state: AccountState,
  form: FormData,
): Promise<AccountState> {
  const p = emailSchema.safeParse(form.get("email"));
  if (!p.success)
    return { message: "Enter a valid email address.", success: false };
  const origin = siteOrigin();
  if (!isConfigured() || !origin) return unavailable;
  const db = await createClient();
  const recovering = form.get("mode") === "recover";
  const redirectTo =
    origin +
    "/auth/confirm?next=" +
    encodeURIComponent(recovering ? "/account/password" : "/reservations");
  const { error } = recovering
    ? await db.auth.resetPasswordForEmail(p.data, { redirectTo })
    : await db.auth.resend({
        type: "signup",
        email: p.data,
        options: { emailRedirectTo: redirectTo },
      });
  if (error && error.status === 429)
    return {
      message: "Too many requests. Wait a few minutes before trying again.",
      success: false,
    };
  return {
    message:
      "If this account is eligible, an email link has been sent. Check your inbox and spam folder.",
    success: true,
  };
}
export async function passwordAction(
  _state: AccountState,
  form: FormData,
): Promise<AccountState> {
  const identity = await requireIdentity("/account/password");
  const p = passwordSchema.safeParse({
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  if (!p.success)
    return {
      message: "Use matching passwords of 12–128 characters.",
      success: false,
    };
  const { error } = await identity.db.auth.updateUser({
    password: p.data.password,
  });
  if (error)
    return {
      message:
        "We could not update your password. Request a fresh recovery link or sign in again.",
      success: false,
    };
  return { message: "Your password has been updated.", success: true };
}
