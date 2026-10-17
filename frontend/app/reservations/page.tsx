import Link from "next/link";
import { getReservations } from "@/lib/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ReservationList } from "@/components/reservation-list";
export const dynamic = "force-dynamic";
export default async function Reservations({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const rows = await getReservations();
  const p = await searchParams;
  return (
    <>
      <WorkspaceNav />
      <div className="section-head">
        <h1>My reservations</h1>
        <Link className="button" href="/rooms">
          Plan a stay
        </Link>
      </div>
      <p className="intro">
        Your drafts, upcoming stays and booking progress. Showing your latest 50
        reservations.
      </p>
      {p.notice === "forbidden" && (
        <div className="notice error" role="alert">
          That workspace is available only to authorized staff.
        </div>
      )}
      <ReservationList rows={rows} />
    </>
  );
}
