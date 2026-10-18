"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
export function StaffSidebar() {
  const path = usePathname();
  return (
    <aside className="admin-sidebar staff-sidebar">
      <Link className="brand" href="/staff">
        Cozy Palace<span>Staff operations</span>
      </Link>
      <nav aria-label="Staff navigation">
        {[
          ["/staff", "Work overview"],
          ["/staff/reservations", "Reservations"],
          ["/staff/reservations/new", "New guest booking"],
          ["/account", "My profile"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-note">
        Guest bookings and hotel service. Management controls are available to
        administrators.
      </div>
      <form action={logoutAction}>
        <button className="plain">Sign out</button>
      </form>
    </aside>
  );
}
