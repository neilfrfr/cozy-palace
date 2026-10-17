import { getReservations } from "@/lib/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ReservationList } from "@/components/reservation-list";
export const dynamic = "force-dynamic";
export default async function Staff() {
  const rows = await getReservations(true);
  return (
    <>
      <WorkspaceNav />
      <h1>Reservation workspace</h1>
      <p className="intro">
        Review booking requests and move each stay through arrival and
        completion. Latest 50 reservations.
      </p>
      <ReservationList rows={rows} staff />
    </>
  );
}
