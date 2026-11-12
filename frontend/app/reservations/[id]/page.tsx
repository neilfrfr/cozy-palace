import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  getBookedNightsByRoom,
  getReservation,
  getRooms,
} from "@/lib/reservations/service";
import { businessDate, guestCanCancel } from "@/lib/operations/schema";
import { errorMessages } from "@/lib/reservations/errors";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ReservationForm } from "@/components/reservation-form";
import { ReservationControls } from "@/components/reservation-controls";
import { bookedAt, formatLabel } from "@/lib/format";
import { canPayOnline, isPaid } from "@/lib/reservations/normalize";
import { xenditKey } from "@/lib/payments/xendit";
import { extrasSummary } from "@/lib/extras";
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
  const rooms = ["draft", "pending", "confirmed"].includes(r.status)
    ? await getRooms()
    : [];
  return (
    <>
      <WorkspaceNav />
      <h1 className="details-title">Reservation {r.reference}</h1>
      <span className={"status " + r.status}>{formatLabel(r.status)}</span>
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
          <dt>Extras</dt>
          <dd>{extrasSummary(r.reservation_extras)}</dd>
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
          {isPaid(r)
            ? "Your request is awaiting staff confirmation."
            : "Pay with E-wallet checkout so our staff can confirm your booking."}{" "}
          We hold the room for you until your check-in day.
        </div>
      )}
      {isPaid(r) && <div className="notice">Payment received. Thank you.</div>}
      {["pending", "confirmed"].includes(r.status) && (
        <div className="notice">
          {guestCanCancel(allocation?.check_in ?? "")
            ? "You can cancel online until 11:59 PM (Manila time) two days before check-in."
            : errorMessages.CANCEL_CUTOFF}
        </div>
      )}
      {r.payments
        ?.filter((p) => p.status === "refunded")
        .map((p) => (
          <div className="notice" key={p.refunded_at}>
            Your payment of ₱{Number(p.amount_paid).toLocaleString("en-PH")} was
            refunded on {bookedAt(p.refunded_at!)}. It can take a few days to
            appear in your GCash or Maya account.
          </div>
        ))}
      <ReservationControls reservation={r}>
        {xenditKey() && canPayOnline(r) && (
          <Link
            className="button secondary"
            href={`/reservations/${r.id}/checkout`}
          >
            E-wallet checkout
          </Link>
        )}
      </ReservationControls>
      {["draft", "pending", "confirmed"].includes(r.status) && (
        <section className="section reservation-update">
          <h2>Update your details</h2>
          <ReservationForm
            rooms={rooms}
            existing={r}
            requestKey={randomUUID()}
            bookedNights={await getBookedNightsByRoom(rooms, r.id)}
            today={businessDate()}
          />
        </section>
      )}
    </>
  );
}
