import Link from "next/link";
import { requireIdentity } from "@/lib/auth/authorize";
import { getMyNotifications } from "@/lib/notifications";
import { bookedAt } from "@/lib/format";
import { WorkspaceNav } from "@/components/workspace-nav";
export const dynamic = "force-dynamic";
export default async function Notifications() {
  const { db } = await requireIdentity("/notifications");
  const notes = await getMyNotifications();
  // Opening the page counts as reading them; this visit still shows which ones were new.
  if (notes.some((n) => !n.read_at)) await db.rpc("mark_notifications_read");
  return (
    <section className="section">
      <WorkspaceNav />
      <h1>Notifications</h1>
      <p className="intro">
        Updates about your bookings. We also email each one to you.
      </p>
      {notes.length ? (
        <ul className="notice-list">
          {notes.map((n) => (
            <li key={n.id}>
              <p>
                <strong>{n.title}</strong>
                {!n.read_at && <span className="status pending">New</span>}
              </p>
              <p>
                <Link href={"/reservations/" + n.reservation_id}>
                  {n.booking}
                </Link>
              </p>
              <p className="subtle">
                {n.next} · {bookedAt(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No notifications yet.</p>
      )}
    </section>
  );
}
