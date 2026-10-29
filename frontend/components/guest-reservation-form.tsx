"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createGuestBookingAction,
  updateGuestBookingAction,
  updateOperationalBookingAction,
  quoteGuestBookingAction,
} from "@/app/staff/reservations/actions";
import {
  bookAsGuestAction,
  quoteStayAction,
} from "@/app/actions/guest-bookings";
import { StayDates } from "@/components/stay-dates";
import { Turnstile } from "@/components/turnstile";
import { errorMessages } from "@/lib/reservations/errors";
import { PhoneField } from "@/components/phone-field";
import type { Room } from "@/lib/reservations/types";
import type { OperationalReservation } from "@/lib/operations/service";
type Input = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestFullName: string;
  guestEmail: string;
  guestPhone: string;
  idempotencyKey?: string;
  id?: string;
  version?: number;
};
export function GuestReservationForm({
  rooms,
  requestKey,
  today,
  existing,
  bookedNights,
  visitor = false,
  defaults,
}: {
  rooms: Room[];
  requestKey: string;
  today: string;
  existing?: OperationalReservation;
  /** Booked nights per room id, greyed out in the calendars. */
  bookedNights: Record<string, string[]>;
  /** A visitor without an account booking for themselves, instead of staff entering a walk-in. */
  visitor?: boolean;
  defaults?: {
    room?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  };
}) {
  const [captcha, setCaptcha] = useState(""),
    [captchaRound, setCaptchaRound] = useState(0);
  const [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [review, setReview] = useState<{
      input: Input;
      quote: { total: number; nights: number; rate: number; room: string };
    } | null>(null);
  const [booked, setBooked] = useState<{
    reference: string;
    email: string;
  } | null>(null);
  const router = useRouter();
  const allocation = existing?.room_bookings[0];
  const [roomId, setRoomId] = useState(
    allocation?.room_id ??
      rooms.find((r) => r.id === defaults?.room)?.id ??
      rooms[0]?.id ??
      "",
  );
  // A customer's details live on their account; walk-in and visitor details are edited here.
  const online = existing?.booking_source === "customer_online";
  // The email is the only way a visitor hears about their booking, so it can't be removed.
  const contactRequired =
    visitor || existing?.booking_source === "guest_online";
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const input: Input = {
      roomId: String(f.get("roomId")),
      checkIn: String(f.get("checkIn")),
      checkOut: String(f.get("checkOut")),
      guests: Number(f.get("guests")),
      guestFullName: String(
        f.get("guestFullName") ?? existing?.customer_name ?? "",
      ),
      guestEmail: String(f.get("guestEmail") ?? ""),
      guestPhone: String(f.get("guestPhone") ?? ""),
    };
    if (existing) {
      input.id = existing.id;
      input.version = existing.version;
    } else input.idempotencyKey = requestKey;
    setError("");
    start(async () => {
      const result = visitor
        ? await quoteStayAction(input)
        : await quoteGuestBookingAction(input, !!existing);
      if (!result.ok) {
        setError(
          errorMessages[result.code] ?? "Could not review this booking.",
        );
        return;
      }
      setCaptcha("");
      setReview({ input, quote: result.data });
    });
  }
  function confirm() {
    if (!review) return;
    setError("");
    start(async () => {
      if (visitor) {
        const result = await bookAsGuestAction(review.input, captcha);
        if (!result.ok) {
          // The CAPTCHA token is single-use; show a fresh check for the retry.
          setCaptcha("");
          setCaptchaRound((n) => n + 1);
          setError(errorMessages[result.code] ?? "Could not book this room.");
          return;
        }
        setBooked({
          reference: result.data.reference,
          email: review.input.guestEmail,
        });
        return;
      }
      const result = existing
        ? online
          ? await updateOperationalBookingAction({
              id: existing.id,
              version: existing.version,
              roomId: review.input.roomId,
              checkIn: review.input.checkIn,
              checkOut: review.input.checkOut,
              guests: review.input.guests,
            })
          : await updateGuestBookingAction(review.input)
        : await createGuestBookingAction(review.input);
      if (!result.ok) {
        setError(
          errorMessages[result.code] ?? "Could not save the guest booking.",
        );
        return;
      }
      router.push("/staff/reservations/" + result.data.id);
      router.refresh();
      setReview(null);
    });
  }
  if (booked)
    return (
      <div className="guest-workflow">
        <section className="notice" role="status">
          <h2>Booking request {booked.reference} received</h2>
          <p>
            We have emailed the details to {booked.email}. The room is held until
            your check-in day while our staff confirm it and arrange payment
            with you.
          </p>
          <p>
            To change or cancel it, contact the front desk and quote{" "}
            {booked.reference}.
          </p>
        </section>
        <Link className="back-link" href="/rooms">
          Back to rooms
        </Link>
      </div>
    );
  return (
    <div className="guest-workflow">
      <form className="form-panel" hidden={!!review} onSubmit={prepare}>
        <fieldset disabled={pending}>
          <legend>
            {online
              ? "Update the guest’s stay"
              : visitor
                ? "Your details and stay"
                : "Guest and stay details"}
          </legend>
          <div className="form-grid">
            {!online && (
              <>
                <label className="full">
                  {visitor ? "Full name" : "Guest full name"}
                  <input
                    name="guestFullName"
                    maxLength={100}
                    required
                    defaultValue={existing?.guest_full_name ?? ""}
                  />
                </label>
                <label>
                  {visitor
                    ? "Email"
                    : contactRequired
                      ? "Guest email"
                      : "Guest email (optional)"}
                  <input
                    name="guestEmail"
                    type="email"
                    required={contactRequired}
                    maxLength={254}
                    defaultValue={existing?.guest_email ?? ""}
                  />
                </label>
                <PhoneField
                  label={
                    visitor
                      ? "Mobile number"
                      : contactRequired
                        ? "Guest phone"
                        : "Guest phone (optional)"
                  }
                  required={contactRequired}
                  defaultValue={existing?.guest_phone ?? ""}
                />
              </>
            )}
            <label className="full">
              Room
              <select
                name="roomId"
                required
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_types.name} · Room {r.room_number} · Up to{" "}
                    {r.room_types.capacity} guests
                  </option>
                ))}
              </select>
            </label>
            <StayDates
              bookedNights={bookedNights[roomId] ?? []}
              min={
                allocation?.check_in && allocation.check_in < today
                  ? allocation.check_in
                  : today
              }
              defaultCheckIn={
                allocation?.check_in ?? defaults?.checkIn ?? today
              }
              defaultCheckOut={allocation?.check_out ?? defaults?.checkOut}
            />
            <label>
              Guests
              <input
                name="guests"
                type="number"
                min={1}
                max={20}
                required
                defaultValue={
                  existing?.guests ?? (Number(defaults?.guests) || 1)
                }
              />
            </label>
          </div>
          <p className="subtle">
            {visitor
              ? "No account needed. We email your booking details to you; our staff confirm it and arrange payment."
              : "No customer account is created for a walk-in guest."}{" "}
            Room availability and the final price are checked when you confirm.
          </p>
          <button className="primary" disabled={pending || !rooms.length}>
            {pending ? "Checking…" : "Review booking"}
          </button>
        </fieldset>
      </form>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {review && (
        <section className="booking-review" aria-label="Review guest booking">
          <h2>Review before confirming</h2>
          <dl className="checkout-summary">
            <div>
              <dt>Guest</dt>
              <dd>{review.input.guestFullName}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{review.quote.room}</dd>
            </div>
            <div>
              <dt>Stay</dt>
              <dd>
                {review.input.checkIn} to {review.input.checkOut} ·{" "}
                {review.input.guests} guests
              </dd>
            </div>
            <div>
              <dt>Price from the server</dt>
              <dd>
                ₱{review.quote.total.toLocaleString("en-PH")} ·{" "}
                {review.quote.nights} nights at ₱
                {review.quote.rate.toLocaleString("en-PH")}
              </dd>
            </div>
          </dl>
          <p>
            {visitor
              ? "Booking holds the room until your check-in day while our staff confirm it. Payment is arranged with the hotel. To change or cancel, contact the front desk with your booking reference."
              : "Confirmation reserves the room for this guest. It does not record a payment."}
          </p>
          {visitor && (
            <Turnstile
              key={captchaRound}
              action="book_room"
              onToken={setCaptcha}
            />
          )}
          <div className="actions">
            <button
              className="primary gold"
              disabled={pending || (visitor && !captcha)}
              onClick={confirm}
            >
              {pending
                ? "Saving…"
                : existing
                  ? "Save booking changes"
                  : visitor
                    ? "Book this room"
                    : "Confirm guest booking"}
            </button>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => setReview(null)}
            >
              Edit details
            </button>
          </div>
        </section>
      )}
      <Link
        className="back-link"
        href={visitor ? "/rooms" : "/staff/reservations"}
      >
        {visitor ? "Back to rooms" : "Back to reservations"}
      </Link>
    </div>
  );
}
