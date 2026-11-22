import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/redirect";
import { isConfigured } from "@/lib/supabase/config";
export async function requireIdentity(next = "/reservations", login = "/login") {
  if (!isConfigured()) redirect("/setup");
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) {
    // An auth cookie without a valid user means the session ended elsewhere (sign-out on another device, expiry), so say why.
    const ended = (await cookies()).getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
    redirect(login + "?next=" + encodeURIComponent(safeRedirect(next)) + (ended ? "&notice=expired" : ""));
  }
  return { userId: data.user.id, email: data.user.email, db };
}
export async function requireStaff(adminOnly = false) {
  const identity = await requireIdentity(
    adminOnly ? "/admin" : "/staff",
    "/staff/login",
  );
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

export async function readRole(
  db: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await db
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new Error(
      "Account permissions could not be verified. Please try again.",
    );
  return data?.role === "admin"
    ? ("admin" as const)
    : data?.role === "staff"
      ? ("staff" as const)
      : ("customer" as const);
}
export function roleHome(role: string) {
  return role === "admin"
    ? "/admin"
    : role === "staff"
      ? "/staff"
      : "/reservations";
}
export async function requireCustomer(next = "/reservations") {
  const identity = await requireIdentity(next);
  const role = await readRole(identity.db, identity.userId);
  if (role !== "customer") redirect(roleHome(role));
  return identity;
}
