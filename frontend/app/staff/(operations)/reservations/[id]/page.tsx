import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import { getOperationalReservation } from "@/lib/operations/service";
import { getBookedNightsByRoom, getRooms } from "@/lib/reservations/service";
import { businessDate } from "@/lib/operations/schema";
import { GuestReservationForm } from "@/components/guest-reservation-form";
import { ReservationControls } from "@/components/reservation-controls";
import { sourceLabel } from "@/lib/format";
import { extrasSummary } from "@/lib/extras";
import {
  getRoomCharges,
  orderMessages,
  paymentMethods,
  peso,
  roomBill,
} from "@/lib/orders";
import { settleRoomBillAction } from "@/app/actions/orders";
import { methodLabel, OrderList } from "@/components/order-list";
export const dynamic = "force-dynamic";
export default async function OperationalDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const { notice, error } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await getOperationalReservation(id);
  if (!r) notFound();
  const charges = await getRoomCharges(r.id);
  const bill = roomBill(r.total, r.reservation_extras ?? [], charges);
  const inHouse = ["checked_in", "completed"].includes(r.status);
  const message = orderMessages[error ?? notice ?? ""];
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
          ["Booking source", sourceLabel(r.booking_source)],
          ["Created by", r.creator_name ?? "Unavailable"],
          ["Room", `${r.room_type_name} · Room ${r.room_number}`],
          ["Stay", `${a?.check_in} to ${a?.check_out}`],
          ["Guests", String(r.guests)],
          ["Extras", extrasSummary(r.reservation_extras)],
          ["Reservation total", `₱${Number(r.total).toLocaleString("en-PH")}`],
          ...(r.booking_source !== "customer_online"
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
      {message && (
        <p
          className={"notice" + (error ? " error" : "")}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {(inHouse || charges.length > 0) && (
        <section className="operations-section">
          <h2>Room bill</h2>
          <dl className="report-figures">
            {[
              ["Room booking", bill.room],
              ["Extras", bill.extras],
              ["Room charges", bill.charges],
              ["Total", bill.total],
              ["Room charges unpaid", bill.unpaid],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{peso(Number(value))}</dd>
              </div>
            ))}
          </dl>
          <p className="subtle">
            The room booking and extras are paid online. Room charges are
            settled here at check-out.
          </p>
          <OrderList rows={charges} staff />
          {inHouse && bill.unpaid > 0 && (
            <form action={settleRoomBillAction} className="inline-form">
              <input type="hidden" name="id" value={r.id} />
              <label>
                Method
                <select name="method" defaultValue="cash">
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {methodLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reference (optional)
                <input name="reference" maxLength={100} />
              </label>
              <button className="button">
                Mark room bill paid ({peso(bill.unpaid)})
              </button>
            </form>
          )}
        </section>
      )}
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
      {["pending", "confirmed"].includes(r.status) && (
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
