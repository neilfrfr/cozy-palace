import Link from "next/link";
import { getStaffDashboard } from "@/lib/operations/service";
export const dynamic = "force-dynamic";
export default async function StaffDashboard() {
  const data = await getStaffDashboard();
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>Hotel operations</h1>
          <p>Work overview · {data.date} · Asia/Manila</p>
        </div>
        <Link className="button gold" href="/staff/reservations/new">
          New guest booking
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
          <Link href="/staff/reservations?status=pending">
            <strong>Review requests</strong>
            <span>Confirm or cancel customer requests.</span>
          </Link>
          <Link href="/staff/reservations">
            <strong>Find a reservation</strong>
            <span>Search by reference, guest, dates or status.</span>
          </Link>
          <Link href="/staff/reservations/new">
            <strong>Welcome a walk-in guest</strong>
            <span>Create a booking on the guest’s behalf.</span>
          </Link>
        </div>
      </section>
      <p className="subtle">
        This is the shared hotel operations queue. Individual task assignments
        and payment collection are not available in this prototype.
      </p>
    </>
  );
}
