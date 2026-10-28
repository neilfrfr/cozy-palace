"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
const links = [
  ["/admin", "Management Overview"],
  ["/staff/reservations", "Reservations"],
  ["/staff/tables", "Table Service"],
  ["/admin/rooms", "Rooms"],
  ["/admin/tables", "Restaurant Tables"],
  ["/admin/staff", "Staff Directory"],
  ["/admin/activity", "Activity Log"],
  ["/admin/profile", "My Profile"],
  ["/", "Public Website"],
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
      <form action={logoutAction} className="sidebar-signout-form">
        <button className="plain sidebar-signout">Sign out</button>
      </form>
    </aside>
  );
}
