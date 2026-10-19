import Link from "next/link";
import type { Reservation } from "@/lib/reservations/types";
import { ReservationControls } from "./reservation-controls";
export function ReservationList({
  rows,
  staff = false,
}: {
  rows: Reservation[];
  staff?: boolean;
}) {
  if (!rows.length)
    return (
      <section className="empty">
        <h2>No reservations yet.</h2>
        <p>
          {staff
            ? "Create a reservation on behalf of a hotel guest."
            : "Start with a room and save your first draft."}
        </p>
        <Link
          className="button"
          href={staff ? "/staff/reservations/new" : "/rooms"}
        >
          {staff ? "New guest booking" : "Explore rooms"}
        </Link>
      </section>
    );
  return (
    <div className="table-wrap">
      <table>
        <caption className="hidden-label">
          {staff ? "Staff reservations" : "Your reservations"}
        </caption>
        <thead>
          <tr>
            <th scope="col">Booking</th>
            <th scope="col">Stay</th>
            <th scope="col">Guests</th>
            <th scope="col">Total</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.reference}</td>
              <td>
                {r.room_bookings[0]?.check_in}
                <br />
                {r.room_bookings[0]?.check_out}
              </td>
              <td>{r.guests}</td>
              <td>₱{Number(r.total).toLocaleString("en-PH")}</td>
              <td>
                <span className={"status " + r.status}>
                  {r.status.replace("_", " ")}
                </span>
              </td>
              <td>
                {staff ? (
                  <ReservationControls reservation={r} staff />
                ) : (
                  <Link className="text-link" href={"/reservations/" + r.id}>
                    View details
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
