import Link from "next/link";
import { getManagementDashboard } from "@/lib/operations/service";
import { formatLabel } from "@/lib/format";
const labels: Record<string, string> = {
  rooms: "Rooms",
  restaurant_tables: "Restaurant Tables",
  staff_members: "Staff records",
  reservations: "Reservation records",
};
export default async function ManagementDashboard() {
  const data = await getManagementDashboard();
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>Management Overview</h1>
          <p>People, inventory and accountable hotel operations.</p>
        </div>
        <Link className="button gold manage-staff-button" href="/admin/staff">
          Manage Staff
        </Link>
      </header>
      <section
        className="management-summary"
        aria-label="Current inventory and record counts"
      >
        {data.counts.map((item) => (
          <div key={item.name}>
            <span>{labels[item.name]}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </section>
      <div className="management-columns">
        <section className="operations-section">
          <h2>Reservations by status</h2>
          <p className="subtle">
            Hotel reservations, excluding private drafts.
          </p>
          <div className="status-ledger">
            {data.statuses.map((item) => (
              <Link
                key={item.status}
                href={"/staff/reservations?status=" + item.status}
              >
                <span>{formatLabel(item.status)}</span>
                <strong>{item.count}</strong>
              </Link>
            ))}
          </div>
          <Link className="text-link" href="/staff/reservations">
            Open reservation oversight →
          </Link>
        </section>
        <section className="operations-section">
          <h2>Staff access</h2>
          <p className="access-count pending-registrations">
            <strong>{data.pendingStaff}</strong> pending registrations
          </p>
          <p>
            Review onboarding records and share the staff registration portal
            with approved employees.
          </p>
          <div className="actions overview-actions">
            <Link className="button secondary" href="/admin/staff">
              Staff Directory
            </Link>
            <Link className="button secondary" href="/staff/register">
            Registration Portal
            </Link>
          </div>
          <h2 className="section-subheading inventory-heading">Inventory</h2>
          <p>
            Review live rooms and restaurant tables. Inventory lists are
            read-only in this increment.
          </p>
          <div className="actions overview-actions">
            <Link className="button secondary" href="/admin/rooms">Rooms</Link>
            <Link className="button secondary" href="/admin/tables">Restaurant Tables</Link>
          </div>
        </section>
      </div>
      <section className="operations-section">
        <div className="section-head">
          <h2>Recent activity</h2>
          <Link className="text-link" href="/admin/activity">
            Full activity log →
          </Link>
        </div>
        {data.recent.length ? (
          <div className="table-wrap">
            <table>
              <caption className="hidden-label">
                Recent attributed changes
              </caption>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.actor_name}
                      <br />
                      <small>{formatLabel(r.actor_role)}</small>
                    </td>
                    <td>{formatLabel(r.action)}</td>
                    <td>{r.reference ?? r.record_id}</td>
                    <td>
                      {new Intl.DateTimeFormat("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Manila",
                      }).format(new Date(r.occurred_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtle">
            No recorded activity yet. Operational and staffing changes will
            appear here.
          </p>
        )}
      </section>
    </>
  );
}
