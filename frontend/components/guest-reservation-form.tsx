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
import * as Flags from "country-flag-icons/react/3x2";
import { StayDates } from "@/components/stay-dates";
import { errorMessages } from "@/lib/reservations/errors";
import {
  phoneCountries,
  phoneCountry as findPhoneCountry,
  phoneError,
  splitPhoneNumber,
} from "@/lib/phone";
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
}: {
  rooms: Room[];
  requestKey: string;
  today: string;
  existing?: OperationalReservation;
  /** Booked nights per room id, greyed out in the calendars. */
  bookedNights: Record<string, string[]>;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [phoneCountry, setPhoneCountry] = useState(() => {
      return splitPhoneNumber(existing?.guest_phone ?? "").countryCode;
    }),
    [phoneDigits, setPhoneDigits] = useState(() => {
      return splitPhoneNumber(existing?.guest_phone ?? "").digits;
    }),
    [review, setReview] = useState<{
      input: Input;
      quote: { total: number; nights: number; rate: number; room: string };
    } | null>(null);
  const router = useRouter();
  const allocation = existing?.room_bookings[0];
  const [roomId, setRoomId] = useState(allocation?.room_id ?? rooms[0]?.id ?? "");
  const online = existing?.booking_source === "customer_online";
  const selectedCountry = findPhoneCountry(phoneCountry);
  const maxPhoneDigits = selectedCountry?.digits ?? 15;
  const Flag = selectedCountry ? Flags[selectedCountry.iso] : undefined;
  const phoneProblem = phoneDigits ? phoneError(phoneCountry, phoneDigits) : "";
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phoneProblem) {
      setError(phoneProblem);
      return;
    }
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
      guestPhone: String(f.get("phoneDigits") ?? "")
        ? `${String(f.get("phoneCountry") ?? phoneCountry)}${String(f.get("phoneDigits") ?? "")}`
        : "",
    };
    if (existing) {
      input.id = existing.id;
      input.version = existing.version;
    } else input.idempotencyKey = requestKey;
    setError("");
    start(async () => {
      const result = await quoteGuestBookingAction(input, !!existing);
      if (!result.ok) {
        setError(
          errorMessages[result.code] ?? "Could not review this booking.",
        );
        return;
      }
      setReview({ input, quote: result.data });
    });
  }
  function confirm() {
    if (!review) return;
    setError("");
    start(async () => {
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
  return (
    <div className="guest-workflow">
      <form
        className="form-panel"
        hidden={!!review}
        onSubmit={prepare}
      >
        <fieldset disabled={pending}>
          <legend>
            {online ? "Update the guest’s stay" : "Guest and stay details"}
          </legend>
          <div className="form-grid">
            {!online && (
              <>
                <label className="full">
                  Guest full name
                  <input
                    name="guestFullName"
                    maxLength={100}
                    required
                    defaultValue={existing?.guest_full_name ?? ""}
                  />
                </label>
                <label>
                  Guest email (optional)
                  <input
                    name="guestEmail"
                    type="email"
                    maxLength={254}
                    defaultValue={existing?.guest_email ?? ""}
                  />
                </label>
                <div className="phone-field">
                  <label htmlFor="guestPhoneDigits">Guest phone (optional)</label>
                  <div className="phone-input-row">
                    <div className="phone-country">
                    <span className="phone-country-code" aria-hidden="true">
                      {Flag && <Flag className="phone-flag" />}
                      {phoneCountry}
                    </span>
                    <select
                      name="phoneCountry"
                      aria-label="Phone country code"
                      value={phoneCountry}
                      onChange={(event) => {
                        setPhoneCountry(event.target.value);
                        setPhoneDigits((digits) => digits.replace(/\D/g, "").slice(0, findPhoneCountry(event.target.value)?.digits ?? 15));
                      }}
                    >
                      {phoneCountries.map((country) => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}
                    </select>
                    </div>
                    <input
                      id="guestPhoneDigits"
                      name="phoneDigits"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={maxPhoneDigits}
                      value={phoneDigits}
                      onChange={(event) => setPhoneDigits(event.target.value.replace(/\D/g, "").slice(0, maxPhoneDigits))}
                      placeholder="Digits only"
                      autoComplete="tel-national"
                      aria-invalid={phoneProblem && phoneDigits.length >= maxPhoneDigits ? true : undefined}
                      aria-describedby="guestPhoneRule"
                    />
                  </div>
                  <p
                    id="guestPhoneRule"
                    className={
                      phoneProblem && phoneDigits.length >= maxPhoneDigits
                        ? "field-hint error"
                        : "field-hint"
                    }
                  >
                    {selectedCountry?.rule}
                  </p>
                </div>
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
              defaultCheckIn={allocation?.check_in ?? today}
              defaultCheckOut={allocation?.check_out}
            />
            <label>
              Guests
              <input
                name="guests"
                type="number"
                min={1}
                max={20}
                required
                defaultValue={existing?.guests ?? 1}
              />
            </label>
          </div>
          <p className="subtle">
            No customer account is created for a walk-in guest. Room
            availability and the final price are checked when you confirm.
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
            Confirmation reserves the room for this guest. It does not record a
            payment.
          </p>
          <div className="actions">
            <button
              className="primary gold"
              disabled={pending}
              onClick={confirm}
            >
              {pending
                ? "Saving…"
                : existing
                  ? "Save booking changes"
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
      <Link className="back-link" href="/staff/reservations">
        Back to reservations
      </Link>
    </div>
  );
}
