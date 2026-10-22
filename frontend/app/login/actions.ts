"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
export async function loginAction(_state: { message: string }, form: FormData) {
  if (!isConfigured())
    return { message: "Booking is not connected yet. Please try again later." };
  const p = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
    .safeParse({ email: form.get("email"), password: form.get("password") });
  if (!p.success) return { message: "Enter a valid email and password." };
  if (form.get("acceptTerms") !== "on")
    return { message: "Agree to the Terms and Conditions to sign in." };
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(p.data);
  if (error)
    return {
      message: "We could not sign you in. Check your email and password.",
    };
  await db.rpc("accept_staff_invitation");
  const requested = String(form.get("next") || "");
  const next = requested ? safeRedirect(requested) : "/";
  if (next === "/" || next === "/reservations") {
    const { data: identity } = await db.auth.getUser();
    const { data: role } = await db
      .from("staff_roles")
      .select("role")
      .eq("user_id", identity.user?.id || "")
      .maybeSingle();
    if (role?.role === "admin") redirect("/admin");
    if (role?.role === "staff") redirect("/staff");
  }
  redirect(next);
}
export async function logoutAction() {
  if (isConfigured()) {
    const db = await createClient();
    await db.auth.signOut();
  }
  redirect("/login");
}
