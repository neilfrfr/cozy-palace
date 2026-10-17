import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/redirect";
import { isConfigured } from "@/lib/supabase/config";
export async function requireIdentity(next = "/reservations") {
  if (!isConfigured()) redirect("/setup");
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user)
    redirect("/login?next=" + encodeURIComponent(safeRedirect(next)));
  return { userId: data.user.id, email: data.user.email, db };
}
export async function requireStaff(adminOnly = false) {
  const identity = await requireIdentity();
  const { data, error } = await identity.db
    .from("staff_roles")
    .select("role")
    .eq("user_id", identity.userId)
    .maybeSingle();
  if (
    error ||
    !data ||
    !["staff", "admin"].includes(data.role) ||
    (adminOnly && data.role !== "admin")
  )
    redirect("/reservations?notice=forbidden");
  return { ...identity, role: data.role as "staff" | "admin" };
}
