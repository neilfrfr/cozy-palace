import Link from "next/link";
import { getAdminCounts } from "@/lib/inventory/service";
const labels: Record<string, string> = {
  rooms: "Rooms",
  restaurant_tables: "Restaurant tables",
  staff_members: "Staff records",
  reservations: "Reservations",
};
export default async function Dashboard() {
  const counts = await getAdminCounts();
  return (
    <>
      <p className="eyebrow">ADMINISTRATION</p>
      <h1>Dashboard</h1>
      <p className="intro">Your current inventory and reservation records.</p>
      <div className="dashboard-grid">
        {counts.map((item) => (
          <section className="panel" key={item.name}>
            <h2>{labels[item.name]}</h2>
            <p className="count">{item.count}</p>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Manage your workspace</h2>
        <p>
          Review hotel reservations, manage team access and trace account
          activity.
        </p>
        <div className="actions">
          <Link className="button gold" href="/staff/reservations">
            View reservations
          </Link>
          <Link className="button secondary" href="/admin/staff">
            Manage staff
          </Link>
          <Link className="button secondary" href="/admin/activity">
            View activity
          </Link>
        </div>
      </section>
    </>
  );
}
