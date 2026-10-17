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
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(p.data);
  if (error)
    return {
      message: "We could not sign you in. Check your email and password.",
    };
  redirect(safeRedirect(String(form.get("next") || "")));
}
export async function logoutAction() {
  if (isConfigured()) {
    const db = await createClient();
    await db.auth.signOut();
  }
  redirect("/login");
}
