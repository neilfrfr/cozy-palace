import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
export function WorkspaceNav() {
  return (
    <nav className="workspace-nav" aria-label="Account navigation">
      <Link href="/reservations">My reservations</Link>
      <Link href="/staff/reservations">Staff workspace</Link>
      <Link href="/admin/activity">Admin activity</Link>
      <form action={logoutAction}>
        <button className="plain">Sign out</button>
      </form>
    </nav>
  );
}
