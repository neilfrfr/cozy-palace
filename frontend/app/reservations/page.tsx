import Link from "next/link";
import { getReservations } from "@/lib/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ReservationList } from "@/components/reservation-list";
import { TableBookingList } from "@/components/table-booking-list";
import { getMyTableBookings } from "@/lib/reservations/dining";
export const dynamic = "force-dynamic";
export default async function Reservations({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; q?: string }>;
}) {
  const p = await searchParams;
  // Letters, digits and dashes only, so the text can't act as a LIKE wildcard.
  const q = (typeof p.q === "string" ? p.q : "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .slice(0, 20);
  const [rows, tableRows] = await Promise.all([
    getReservations(false, q),
    getMyTableBookings(q),
  ]);
  return (
    <>
      <WorkspaceNav />
      <div className="section-head">
        <h1>Your Reservations</h1>
        <Link className="button" href="/rooms">
          Plan a stay
        </Link>
      </div>
      <p className="intro">
        Review your saved drafts, upcoming stays, and booking progress. This
        list shows your latest 50 reservations.
      </p>
      <form className="operations-filters" action="/reservations" role="search">
        <label>
          Search my bookings
          <input
            name="q"
            defaultValue={q}
            maxLength={20}
            placeholder="Booking reference, e.g. CP-84347528"
          />
        </label>
        <div className="actions">
          <button className="button">Find</button>
          {q && (
            <Link className="button secondary" href="/reservations">
              Show all
            </Link>
          )}
        </div>
      </form>
      {p.notice === "forbidden" && (
        <div className="notice error" role="alert">
          That workspace is available only to authorized staff.
        </div>
      )}
      {/* While searching, an empty list means "no match", not "no bookings yet". */}
      {q && !rows.length && !tableRows.length && (
        <p className="notice" role="status">
          No reservation matches {q}.
        </p>
      )}
      {(!q || rows.length > 0) && (
        <section className="reservation-group" aria-labelledby="room-reservations-title">
          <div className="section-head">
            <h2 id="room-reservations-title">Room Reservations</h2>
          </div>
          <ReservationList rows={rows} />
        </section>
      )}
      {(!q || tableRows.length > 0) && (
        <section className="reservation-group table-reservation-group" aria-labelledby="table-reservations-title">
          <div className="section-head">
            <h2 id="table-reservations-title">Table Reservations</h2>
            <Link className="button" href="/dining">
              Book a table
            </Link>
          </div>
          <TableBookingList rows={tableRows} />
        </section>
      )}
    </>
  );
}
