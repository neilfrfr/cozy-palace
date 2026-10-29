"use client";
import { useState, useTransition, type FormEvent } from "react";
import { findGuestBookingAction, type GuestBookingSummary } from "@/app/actions/guest-bookings";
import { formatLabel } from "@/lib/format";

export function GuestBookingLookup() {
  const [booking, setBooking] = useState<GuestBookingSummary>();
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    start(async () => {
      const result = await findGuestBookingAction({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        reference: form.get("reference"),
      });
      setBooking(result.ok ? result.booking : undefined);
      if (!result.ok) setMessage(result.message);
    });
  }
  return (
    <div className="guest-lookup-layout">
      <form className="form-panel" onSubmit={submit}>
        <h2>Find your booking</h2>
        <p>Use the name on your booking and its confirmation number.</p>
        <div className="form-grid">
          <label>First name<input name="firstName" autoComplete="given-name" required maxLength={60} /></label>
          <label>Last name<input name="lastName" autoComplete="family-name" required maxLength={60} /></label>
          <label className="full">Confirmation number<input name="reference" placeholder="CP-XXXXXXXXXXXX" required pattern="CP-[A-Fa-f0-9]{12}" /></label>
        </div>
        {message && <p className="notice error" role="alert">{message}</p>}
        <button className="primary gold" disabled={pending}>{pending ? "Looking…" : "Find booking"}</button>
      </form>
      {booking && <section className="booking-review lookup-result" aria-live="polite">
        <p className="eyebrow">{booking.kind === "hotel" ? "Room reservation" : "Table reservation"}</p>
        <h2>{booking.guestName}</h2>
        <p className="guest-reference">{booking.reference}</p>
        <dl className="checkout-summary">
          <div><dt>Status</dt><dd>{formatLabel(booking.status)}</dd></div>
          <div><dt>Guests</dt><dd>{booking.guests}</dd></div>
          {booking.kind === "hotel" ? <>
            <div><dt>Room</dt><dd>{booking.details?.room ?? "—"}</dd></div>
            <div><dt>Check-in</dt><dd>{booking.details?.checkIn ?? "—"}</dd></div>
            <div><dt>Check-out</dt><dd>{booking.details?.checkOut ?? "—"}</dd></div>
            <div><dt>Estimated total</dt><dd>{booking.currency} {Number(booking.total).toLocaleString("en-PH")}</dd></div>
          </> : <>
            <div><dt>Table</dt><dd>{booking.details?.table ?? "—"}</dd></div>
            <div><dt>Seating</dt><dd>{booking.details?.date} · {booking.details?.time}</dd></div>
          </>}
        </dl>
        <p className="subtle">A staff member must confirm a pending request. For changes, contact the hotel using the details on our Contact page.</p>
      </section>}
    </div>
  );
}
