import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getReservation, getRooms } from "@/lib/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ReservationForm } from "@/components/reservation-form";
import { ReservationControls } from "@/components/reservation-controls";
export const dynamic = "force-dynamic";
export default async function Details({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await getReservation(id);
  if (!r) notFound();
  const allocation = r.room_bookings[0];
  return (
    <>
      <WorkspaceNav />
      <h1 className="details-title">Reservation {r.reference}</h1>
      <span className={"status " + r.status}>{r.status.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}</span>
      <dl className="details">
        <div>
          <dt>Check-in</dt>
          <dd>{allocation?.check_in}</dd>
        </div>
        <div>
          <dt>Check-out</dt>
          <dd>{allocation?.check_out}</dd>
        </div>
        <div>
          <dt>Guests</dt>
          <dd>{r.guests}</dd>
        </div>
        <div>
          <dt>Total in PHP</dt>
          <dd>₱{Number(r.total).toLocaleString("en-PH")}</dd>
        </div>
      </dl>
      {r.status === "draft" && (
        <div className="notice">
          Your draft is saved. The room is not reserved until you submit your
          request.
        </div>
      )}
      {r.status === "pending" && (
        <div className="notice">
          Your request is awaiting staff confirmation. Pending holds can expire
          after 24 hours or at the start of the stay.
        </div>
      )}
      <ReservationControls reservation={r} />
      <div className="actions">
        <Link
          className="button secondary"
          href={`/reservations/${r.id}/checkout`}
        >
          E-wallet checkout
        </Link>
      </div>
      {["draft", "pending", "confirmed"].includes(r.status) && (
        <section className="section reservation-update">
          <h2>Update your details</h2>
          <ReservationForm
            rooms={await getRooms()}
            existing={r}
            requestKey={randomUUID()}
          />
        </section>
      )}
    </>
  );
}
