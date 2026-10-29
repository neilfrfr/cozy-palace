import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import { getOperationalReservation } from "@/lib/operations/service";
import { getBookedNightsByRoom, getRooms } from "@/lib/reservations/service";
import { businessDate } from "@/lib/operations/schema";
import { GuestReservationForm } from "@/components/guest-reservation-form";
import { ReservationControls } from "@/components/reservation-controls";
export const dynamic = "force-dynamic";
export default async function OperationalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await getOperationalReservation(id);
  if (!r) notFound();
  const a = r.room_bookings[0];
  const rooms = ["pending", "confirmed"].includes(r.status)
    ? await getRooms()
    : [];
  return (
    <>
      <Link className="back-link" href="/staff/reservations">
        All reservations
      </Link>
      <header className="operations-heading">
        <div>
          <h1>{r.reference}</h1>
          <p>
            {r.guest_full_name ?? r.customer_name ?? "Guest name unavailable"}
          </p>
        </div>
        <span className={"status " + r.status}>
          {r.status.replaceAll("_", " ")}
        </span>
      </header>
      <dl className="details operational-details">
        {[
          [
            "Booking source",
            r.booking_source === "staff_guest"
              ? "Staff-entered guest"
              : r.booking_source === "guest_online"
                ? "Guest online"
                : "Customer online",
          ],
          ["Created by", r.creator_name ?? "Unavailable"],
          ["Room", `${r.room_type_name} · Room ${r.room_number}`],
          ["Stay", `${a?.check_in} to ${a?.check_out}`],
          ["Guests", String(r.guests)],
          ["Reservation total", `₱${Number(r.total).toLocaleString("en-PH")}`],
          ...(r.booking_source === "staff_guest" || r.booking_source === "guest_online"
            ? [
                ["Guest email", r.guest_email ?? "Not provided"],
                ["Guest phone", r.guest_phone ?? "Not provided"],
              ]
            : []),
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="operations-section">
        <h2>Service progress</h2>
        <ReservationControls
          reservation={r}
          staff
          businessDay={businessDate()}
        />
        <p className="subtle">
          Confirmation is a booking status, not proof of payment. Changes are
          attributed to your employee account.
        </p>
      </section>
      {r.booking_source !== "guest_online" && ["pending", "confirmed"].includes(r.status) && (
        <section className="operations-section">
          <h2>Update booking</h2>
          <GuestReservationForm
            rooms={rooms}
            existing={r}
            requestKey={randomUUID()}
            today={businessDate()}
            bookedNights={await getBookedNightsByRoom(rooms, r.id)}
          />
        </section>
      )}
    </>
  );
}
