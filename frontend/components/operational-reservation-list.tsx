import Link from "next/link";
import type { OperationalReservation } from "@/lib/operations/service";
import { formatLabel, sourceLabel } from "@/lib/format";
export function OperationalReservationList({
  rows,
}: {
  rows: OperationalReservation[];
}) {
  if (!rows.length)
    return (
      <section className="operations-empty">
        <h2>No matching reservations</h2>
        <p>
          Try another filter, or create a booking for a guest visiting the
          hotel.
        </p>
        <Link className="button gold" href="/staff/reservations/new">
          New Guest Booking
        </Link>
      </section>
    );
  return (
    <div className="table-wrap operations-table">
      <table>
        <caption className="hidden-label">
          Operational hotel reservations
        </caption>
        <thead>
          <tr>
            <th>Reference and guest</th>
            <th>Stay</th>
            <th>Room</th>
            <th>Source</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.reference}</strong>
                <br />
                <span>
                  {r.guest_full_name ?? r.customer_name ?? "Name unavailable"}
                </span>
              </td>
              <td>
                {r.room_bookings[0]?.check_in}
                <br />
                {r.room_bookings[0]?.check_out}
                <br />
                <small>{r.guests} guests</small>
              </td>
              <td>
                {r.room_type_name}
                <br />
                Room {r.room_number}
              </td>
              <td>
                {sourceLabel(r.booking_source)}
              </td>
              <td>
                <span className={"status " + r.status}>
                  {formatLabel(r.status)}
                </span>
              </td>
              <td>
                <Link
                  className="text-link"
                  href={"/staff/reservations/" + r.id}
                >
                  Open<span className="hidden-label"> {r.reference}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
