import Link from "next/link";
import {
  getManagementDashboard,
  getOverviewInsights,
} from "@/lib/operations/service";
import { businessDate } from "@/lib/operations/schema";
import { formatLabel } from "@/lib/format";
import { KeyRack, deskDate } from "@/components/key-rack";
import {
  BookingBars,
  RevenueTrend,
  RoomsBar,
} from "@/components/overview-charts";
const labels: Record<string, string> = {
  rooms: "Rooms",
  restaurant_tables: "Restaurant tables",
  staff_members: "Staff",
};
const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");
const monthName = (m: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "UTC" }).format(
    new Date(m + "-01T00:00:00Z"),
  );
/** Thin line icons for the stat cards; decoration only. */
const icons = {
  in: "M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",
  out: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  bed: "M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1M7 12.5a1.5 1.5 0 1 0 0-.01",
  coins:
    "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
};
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="overview-icon">
    <path d={d} />
  </svg>
);
// Statuses that still need someone; the rest are history.
const open = ["pending", "confirmed", "checked_in"];
const openNames: Record<string, string> = {
  pending: "Booking requests",
  confirmed: "Confirmed stays",
  checked_in: "Guests in house",
};
export default async function ManagementDashboard() {
  const [data, view] = await Promise.all([
    getManagementDashboard(),
    getOverviewInsights(),
  ]);
  const taken = view.rooms.occupied + view.rooms.reserved;
  const sellable = view.totalRooms - view.rooms.closed;
  const thisMonth = view.money.months.at(-1)!.month;
  const lastMonth = view.money.months.at(-2)!.month;
  const change = view.money.change;
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
      <div className="overview-stack">
        <section className="overview-stats" aria-label="Today in numbers">
          <Link
            className="overview-stat"
            href={`/staff/reservations?status=confirmed&date=${view.today}`}
          >
            <span className="overview-stat-name">
              <Icon d={icons.in} />
              Check-ins today
            </span>
            <strong>{view.moves.checkIns}</strong>
            <span className="overview-stat-note">
              {view.moves.checkIns
                ? `${view.moves.arrived} already arrived`
                : "No arrivals due"}
            </span>
          </Link>
          <Link
            className="overview-stat"
            href="/staff/reservations?status=checked_in"
          >
            <span className="overview-stat-name">
              <Icon d={icons.out} />
              Check-outs today
            </span>
            <strong>{view.moves.checkOuts}</strong>
            <span className="overview-stat-note">
              {view.moves.checkOuts
                ? `${view.moves.left} already left`
                : "No departures due"}
            </span>
          </Link>
          <Link className="overview-stat" href="/admin/rooms">
            <span className="overview-stat-name">
              <Icon d={icons.bed} />
              Rooms taken tonight
            </span>
            <strong>
              {taken} <small>of {view.totalRooms}</small>
            </strong>
            <span className="overview-stat-note">
              {sellable
                ? `${Math.round((taken / sellable) * 100)}% of open rooms`
                : "Every room is closed"}
            </span>
          </Link>
          <Link className="overview-stat is-feature" href="/admin/reports">
            <span className="overview-stat-name">
              <Icon d={icons.coins} />
              Collected in {monthName(thisMonth)}
            </span>
            <strong>{peso(view.money.soFar)}</strong>
            <span className="overview-stat-note">
              {change === null
                ? `Nothing collected by this day in ${monthName(lastMonth)}`
                : `${change >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(change * 100))}% on the same days of ${monthName(lastMonth)}`}
            </span>
          </Link>
        </section>
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
        <div className="overview-pair">
          <section className="overview-card" aria-labelledby="rooms-tonight">
            <div className="section-head">
              <h2 id="rooms-tonight">Rooms tonight</h2>
              <Link className="text-link" href="/admin/rooms">
                Rooms and close dates
              </Link>
            </div>
            <RoomsBar rooms={view.rooms} today={view.today} />
          </section>
          <section className="overview-card" aria-labelledby="collected">
            <div className="section-head">
              <h2 id="collected">Collected, last 6 months</h2>
              <Link className="text-link" href="/admin/reports">
                Open reports
              </Link>
            </div>
            <RevenueTrend months={view.money.months} />
          </section>
        </div>
        <section className="overview-card" aria-labelledby="new-bookings">
          <div className="section-head">
            <h2 id="new-bookings">New bookings</h2>
            <span className="overview-key" aria-hidden="true">
              <span>
                <i className="rooms" /> Rooms
              </span>
              <span>
                <i className="tables" /> Tables
              </span>
            </span>
          </div>
          <BookingBars days={view.bookings} />
        </section>
        <div className="overview-pair">
          <section className="overview-card">
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
          <section className="overview-card">
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
        <section className="overview-card">
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
      </div>
    </>
  );
}
