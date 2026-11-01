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
  const { count: unread } = staff
    ? { count: 0 }
    : await db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
  const admin = data?.role === "admin";
  return (
    <nav className="workspace-nav" aria-label="Account navigation">
      {!staff && <Link href="/reservations">My Reservations</Link>}
      {!staff && <Link href="/purchases">My Purchases</Link>}
      {!staff && (
        <Link href="/notifications">
          Notifications{unread ? ` (${unread})` : ""}
        </Link>
      )}
      <Link
        href={
          staff ? (admin ? "/admin/profile" : "/staff/profile") : "/account"
        }
      >
        My Profile
      </Link>
      {staff && <Link href="/staff">Staff workspace</Link>}
      {admin && (
        <>
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/staff">Staff Directory</Link>
          <Link href="/admin/activity">Activity Log</Link>
        </>
      )}
      <form action={logoutAction}>
        <button className="plain">Sign out</button>
      </form>
    </nav>
  );
}
