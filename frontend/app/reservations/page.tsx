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
  searchParams: Promise<{ notice?: string }>;
}) {
  const [rows, tableRows] = await Promise.all([
    getReservations(),
    getMyTableBookings(),
  ]);
  const p = await searchParams;
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
      {p.notice === "forbidden" && (
        <div className="notice error" role="alert">
          That workspace is available only to authorized staff.
        </div>
      )}
      <ReservationList rows={rows} />
      <div className="section-head">
        <h2>Table Bookings</h2>
        <Link className="button" href="/dining">
          Book a table
        </Link>
      </div>
      <TableBookingList rows={tableRows} />
    </>
  );
}
