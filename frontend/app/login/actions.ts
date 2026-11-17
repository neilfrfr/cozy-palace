"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
import { authFailure, captchaToken } from "@/lib/auth/captcha";
import { readRole, roleHome } from "@/lib/auth/authorize";
type LoginState = { message: string };
// Guests sign in at /login, staff and admin at /staff/login; each refuses the other's accounts.
async function signIn(form: FormData, portal: "guest" | "staff") {
  if (!isConfigured())
    return { message: "Booking is not connected yet. Please try again later." };
  const p = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
    .safeParse({ email: form.get("email"), password: form.get("password") });
  if (!p.success) return { message: "Enter a valid email and password." };
  if (form.get("acceptTerms") !== "on")
    return { message: "Agree to the Terms and Conditions to sign in." };
  const db = await createClient();
  const { data, error } = await db.auth.signInWithPassword({
    ...p.data,
    options: { captchaToken: captchaToken(form) },
  });
  if (error) return { message: authFailure(error) };
  await db.rpc("accept_staff_invitation");
  let role: Awaited<ReturnType<typeof readRole>>;
  try {
    role = await readRole(db, data.user.id);
  } catch {
    await db.auth.signOut();
    return {
      message: "Account permissions could not be verified. Please try again.",
    };
  }
  const employee = role !== "customer";
  if (portal === "guest" && employee) {
    await db.auth.signOut();
    return { message: "Staff and admin accounts sign in at /staff/login." };
  }
  if (portal === "staff" && !employee) {
    await db.auth.signOut();
    return {
      message: "This login is for staff and admin. Guests sign in at /login.",
    };
  }
  const requested = String(form.get("next") || "");
  redirect(
    requested
      ? safeRedirect(requested)
      : portal === "staff"
        ? roleHome(role)
        : "/",
  );
}
export async function loginAction(_state: LoginState, form: FormData) {
  return signIn(form, "guest");
}
export async function staffLoginAction(_state: LoginState, form: FormData) {
  return signIn(form, "staff");
}
export async function logoutAction() {
  let to = "/login";
  if (isConfigured()) {
    const db = await createClient();
    const { data } = await db.auth.getUser();
    if (data.user) {
      const role = await readRole(db, data.user.id).catch(() => "customer");
      if (role !== "customer") to = "/staff/login";
    }
    await db.auth.signOut();
  }
  redirect(to);
}
/** Called by IdleLogout on staff and admin pages. */
export async function idleLogoutAction() {
  if (isConfigured()) {
    const db = await createClient();
    await db.auth.signOut();
  }
  redirect("/staff/login?notice=timeout");
}
