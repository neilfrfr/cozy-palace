import Link from "next/link";
import { getManagementDashboard } from "@/lib/operations/service";
import { businessDate } from "@/lib/operations/schema";
import { formatLabel } from "@/lib/format";
import { KeyRack, deskDate } from "@/components/key-rack";
const labels: Record<string, string> = {
  rooms: "Rooms",
  restaurant_tables: "Restaurant tables",
  staff_members: "Staff",
  reservations: "Reservations on record",
};
// Statuses that still need someone; the rest are history.
const open = ["pending", "confirmed", "checked_in"];
const openNames: Record<string, string> = {
  pending: "Booking requests",
  confirmed: "Confirmed stays",
  checked_in: "Guests in house",
};
export default async function ManagementDashboard() {
  const data = await getManagementDashboard();
  const count = (status: string) =>
    data.statuses.find((s) => s.status === status)?.count ?? 0;
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>{deskDate(businessDate())}</h1>
          <p>The hotel at a glance, and what&apos;s waiting on someone.</p>
        </div>
        <Link className="button gold" href="/admin/staff">
          Invite staff
        </Link>
      </header>
      <KeyRack
        label="Work waiting across the hotel"
        items={[
          ...open.map((status) => ({
            name: openNames[status],
            count: count(status),
            href: "/staff/reservations?status=" + status,
          })),
          {
            name: "Table requests",
            count: data.pendingTables,
            href: "/staff/tables",
          },
          {
            name: "Staff invitations",
            count: data.pendingStaff,
            href: "/admin/staff",
          },
        ]}
      />
      <div className="management-columns">
        <section className="operations-section">
          <h2>Finished bookings</h2>
          <dl className="desk-ledger">
            {data.statuses
              .filter((s) => !open.includes(s.status))
              .map((s) => (
                <div key={s.status}>
                  <dt>
                    <Link href={"/staff/reservations?status=" + s.status}>
                      {formatLabel(s.status)}
                    </Link>
                  </dt>
                  <dd>{s.count}</dd>
                </div>
              ))}
          </dl>
        </section>
        <section className="operations-section">
          <h2>The hotel</h2>
          <dl className="desk-ledger">
            {data.counts.map((item) => (
              <div key={item.name}>
                <dt>{labels[item.name]}</dt>
                <dd>{item.count}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section className="operations-section">
        <div className="section-head">
          <h2>Recent activity</h2>
          <Link className="text-link" href="/admin/activity">
            See the full activity log
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
            Nothing recorded yet. Bookings, payments and staff changes appear
            here as they happen.
          </p>
        )}
      </section>
    </>
  );
}
