import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { requireIdentity } from "@/lib/auth/authorize";
export async function WorkspaceNav() {
  const { db, userId } = await requireIdentity();
  const { data } = await db
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const staff = data?.role === "staff" || data?.role === "admin";
  const admin = data?.role === "admin";
  return (
    <nav className="workspace-nav" aria-label="Account navigation">
      <Link href="/reservations">My reservations</Link>
      <Link href="/account">My profile</Link>
      {staff && <Link href="/staff/reservations">Staff workspace</Link>}
      {admin && (
        <>
          <Link href="/admin/staff">Staff directory</Link>
          <Link href="/admin/activity">Admin activity</Link>
        </>
      )}
      <form action={logoutAction}>
        <button className="plain">Sign out</button>
      </form>
    </nav>
  );
}
