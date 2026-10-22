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
          ["/staff/reservations/new", "New Guest Booking"],
          ["/staff/profile", "My Profile"],
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
      <form action={logoutAction} className="sidebar-signout-form">
        <button className="plain sidebar-signout">Sign out</button>
      </form>
      <div className="sidebar-note">
        Guest bookings and hotel service. Management controls are available to
        administrators.
      </div>
    </aside>
  );
}
