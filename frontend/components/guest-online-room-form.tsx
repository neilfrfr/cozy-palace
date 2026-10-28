"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { StayDates } from "@/components/stay-dates";
import { createGuestOnlineReservationAction } from "@/app/actions/reservations";
import { phoneCountries, phoneError } from "@/lib/phone";
import { addDays } from "@/lib/reservations/availability";
import type { Room } from "@/lib/reservations/types";
import { errorMessages } from "@/lib/reservations/errors";

export function GuestOnlineRoomForm({
  rooms,
  bookedNights,
  today,
  defaults = {},
}: {
  rooms: Room[];
  bookedNights: Record<string, string[]>;
  today: string;
  defaults?: { room?: string; checkIn?: string; checkOut?: string; guests?: string };
}) {
  const [roomId, setRoomId] = useState(defaults.room || rooms[0]?.id || "");
  const [country, setCountry] = useState("+63");
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<{ reference: string }>();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const idempotencyKey = useRef<string | null>(null);
  const phoneRule = phoneError(country, digits);

  function submit(form: FormData) {
    setError("");
    idempotencyKey.current ??= crypto.randomUUID();
    start(async () => {
      const saved = await createGuestOnlineReservationAction({
        roomId,
        checkIn: String(form.get("checkIn") ?? ""),
        checkOut: String(form.get("checkOut") ?? ""),
        guests: Number(form.get("guests")),
        guestFullName: String(form.get("guestFullName") ?? ""),
        guestEmail: String(form.get("guestEmail") ?? ""),
        guestPhone: country + digits,
        idempotencyKey: idempotencyKey.current,
      });
      if (!saved.ok) {
        idempotencyKey.current = null;
        setError(errorMessages[saved.code] ?? "We could not save this request. Check your details and try again.");
        return;
      }
      idempotencyKey.current = null;
      setResult({ reference: saved.data.reference });
    });
  }

  if (result) return (
    <section className="booking-review" aria-live="polite">
      <p className="eyebrow">Request received</p>
      <h2>Your booking is pending review</h2>
      <p>Keep this confirmation number. You can look up your booking with your first and last name.</p>
      <p className="guest-reference">{result.reference}</p>
      <div className="actions">
        <Link className="button gold" href="/reservations/lookup">Find your booking</Link>
        <Link className="button secondary" href="/">Return home</Link>
      </div>
    </section>
  );

  return (
    <form action={submit} className="form-panel guest-online-form">
      <h2>Guest and stay details</h2>
      <div className="form-grid">
        <label className="full">Room
          <select name="roomId" required value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.room_types.name} · Room {room.room_number} · Up to {room.room_types.capacity} guests · ₱{Number(room.room_types.nightly_rate).toLocaleString("en-PH")}/night</option>)}
          </select>
        </label>
        <StayDates bookedNights={bookedNights[roomId] ?? []} min={addDays(today, 1)} defaultCheckIn={defaults.checkIn} defaultCheckOut={defaults.checkOut} />
        <label>Guests
          <input type="number" name="guests" min="1" max="20" defaultValue={defaults.guests || "2"} required />
        </label>
        <label>Full name
          <input name="guestFullName" autoComplete="name" minLength={2} maxLength={100} required />
        </label>
        <label>Email
          <input name="guestEmail" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="full">Phone
          <span className="phone-entry">
            <select aria-label="Phone country code" value={country} onChange={(e) => setCountry(e.target.value)}>
              {phoneCountries.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
            </select>
            <input type="tel" inputMode="numeric" autoComplete="tel-national" value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, phoneCountries.find((c) => c.code === country)?.digits ?? 15))} placeholder="Mobile number" required aria-invalid={digits.length > 0 && !!phoneRule} />
          </span>
          <small className="field-hint">{digits && phoneRule ? phoneRule : phoneCountries.find((c) => c.code === country)?.rule}</small>
        </label>
      </div>
      <p className="subtle">No account is needed. Your request stays pending until our team confirms availability. No payment is recorded here.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="actions">
        <button className="primary gold" disabled={pending || !rooms.length || !!phoneRule}>{pending ? "Sending request…" : "Request this stay"}</button>
        <Link className="button secondary" href="/reservations/lookup">Back to reservations</Link>
      </div>
    </form>
  );
}
