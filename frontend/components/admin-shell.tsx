"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
const links = [
  ["/admin", "Management overview"],
  ["/staff/reservations", "Reservations"],
  ["/admin/rooms", "Rooms"],
  ["/admin/tables", "Restaurant tables"],
  ["/admin/staff", "Staff directory"],
  ["/admin/activity", "Activity log"],
  ["/account", "My profile"],
  ["/", "Public website"],
] as const;
export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="brand">
        Cozy Palace<span>Hotel and Restaurant</span>
      </Link>
      <nav aria-label="Administration">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form action={logoutAction}>
        <button className="plain">Sign out</button>
      </form>
    </aside>
  );
}
