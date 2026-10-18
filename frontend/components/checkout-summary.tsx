import Link from "next/link";
import type { Reservation } from "@/lib/reservations/types";
import type { InventoryRoom } from "@/lib/inventory/service";
export function CheckoutSummary({
  reservation: r,
  room,
}: {
  reservation: Reservation;
  room: InventoryRoom | null;
}) {
  const allocation = r.room_bookings[0];
  return (
    <>
      <p className="eyebrow">YOUR RESERVATION</p>
      <h1>E-wallet Checkout</h1>
      <p className="intro">Review your reservation and payment availability.</p>
      <section
        className="panel checkout-panel"
        aria-label="Reservation checkout summary"
      >
        <dl className="checkout-summary">
          <div>
            <dt>Reservation</dt>
            <dd>{r.reference}</dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd>
              {room
                ? `${room.room_types.name} · Room ${room.room_number}`
                : "Room details unavailable"}
            </dd>
          </div>
          <div>
            <dt>Dates and guests</dt>
            <dd>
              {allocation
                ? `${allocation.check_in} to ${allocation.check_out}`
                : "Dates unavailable"}{" "}
              · {r.guests} guests
            </dd>
          </div>
          <div>
            <dt>Booking status</dt>
            <dd>
              <span className={"status " + r.status}>
                {r.status.replaceAll("_", " ")}
              </span>
            </dd>
          </div>
          <div>
            <dt>Payment method</dt>
            <dd>E-wallet · unavailable</dd>
          </div>
          <div className="total">
            <dt>Reservation total ({r.currency})</dt>
            <dd>
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: r.currency,
              }).format(Number(r.total))}
            </dd>
          </div>
        </dl>
      </section>
      <p className="notice" id="payment-unavailable">
        E-wallet payments are not available yet. Contact staff for payment
        arrangements.
      </p>
      <div className="actions">
        <button
          className="primary gold"
          type="button"
          disabled
          aria-describedby="payment-unavailable"
        >
          Payment unavailable
        </button>
        <Link className="button secondary" href={`/reservations/${r.id}`}>
          Back to reservation
        </Link>
      </div>
    </>
  );
}
