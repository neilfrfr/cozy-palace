"use client";
import { useActionState } from "react";
import { findReservationAction } from "@/app/actions/find-reservation";
import { bookedAt, formatLabel } from "@/lib/format";

export function FindReservationForm() {
  const [state, submit, pending] = useActionState(findReservationAction, {});
  const b = state.found;
  return (
    <>
      <form action={submit} className="form-panel">
        <div className="form-grid">
          <label>
            First name
            <input
              name="first"
              autoComplete="given-name"
              required
              maxLength={50}
            />
          </label>
          <label>
            Last name
            <input
              name="last"
              autoComplete="family-name"
              required
              maxLength={50}
            />
          </label>
          <label className="full">
            Booking number
            <input
              name="reference"
              required
              maxLength={20}
              placeholder="e.g. 1042"
            />
          </label>
        </div>
        {state.message && (
          <p role="alert" className="notice error">
            {state.message}
          </p>
        )}
        <button className="primary" disabled={pending}>
          {pending ? "Please wait…" : "Find my booking"}
        </button>
      </form>
      {b && (
        <section className="section" aria-live="polite">
          <h2>
            {b.reference}{" "}
            <span className={"status " + b.status}>
              {formatLabel(b.status)}
            </span>
          </h2>
          <dl className="details">
            {b.stay && (
              <>
                <dt>Room</dt>
                <dd>{b.stay.room}</dd>
                <dt>Dates</dt>
                <dd>
                  {b.stay.check_in} to {b.stay.check_out}
                </dd>
              </>
            )}
            {b.table && (
              <>
                <dt>Table</dt>
                <dd>{b.table.table}</dd>
                <dt>Seating</dt>
                <dd>{bookedAt(b.table.start_at)}</dd>
              </>
            )}
            <dt>Guests</dt>
            <dd>{b.guests}</dd>
            <dt>Total</dt>
            <dd>₱{Number(b.total).toLocaleString("en-PH")}</dd>
            <dt>Booked on</dt>
            <dd>{bookedAt(b.created_at)}</dd>
          </dl>
          <h3>History</h3>
          <ul>
            {b.history.map((h) => (
              <li key={h.at + h.action}>
                {formatLabel(h.action)} · {bookedAt(h.at)}
              </li>
            ))}
          </ul>
          <p className="notice">
            To change or cancel this booking, contact the front desk and quote{" "}
            {b.reference}.
          </p>
        </section>
      )}
    </>
  );
}
