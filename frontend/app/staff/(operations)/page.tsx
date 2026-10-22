import Link from "next/link";
import { getStaffDashboard } from "@/lib/operations/service";
export const dynamic = "force-dynamic";
export default async function StaffDashboard() {
  const data = await getStaffDashboard();
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>Hotel Operations</h1>
          <p>Work overview · {data.date} · Asia/Manila</p>
        </div>
        <Link className="button gold" href="/staff/reservations/new">
          New Guest Booking
        </Link>
      </header>
      <section className="operations-board" aria-label="Hotel work priorities">
        {data.metrics.map((item) => (
          <Link className="priority-row" href={item.href} key={item.name}>
            <span>{item.name}</span>
            <strong>{item.count}</strong>
            <span className="text-link">Open queue →</span>
          </Link>
        ))}
      </section>
      <section className="operations-section">
        <h2>Keep every stay moving</h2>
        <div className="work-links">
          <article className="work-card">
            <h3>Review requests</h3><p>Confirm or cancel customer requests.</p>
            <Link className="button secondary" href="/staff/reservations?status=pending">Review requests</Link>
          </article>
          <article className="work-card">
            <h3>Find a reservation</h3><p>Search by reference, guest, dates or status.</p>
            <Link className="button secondary" href="/staff/reservations">Find a reservation</Link>
          </article>
          <article className="work-card">
            <h3>Welcome a walk-in guest</h3><p>Create a booking on the guest’s behalf.</p>
            <Link className="button secondary" href="/staff/reservations/new">Welcome a walk-in guest</Link>
          </article>
        </div>
      </section>
      <p className="subtle">
        This is the shared hotel operations queue. Individual task assignments
        and payment collection are not available in this prototype.
      </p>
    </>
  );
}
