"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createReservationAction,
  updateReservationAction,
} from "@/app/actions/reservations";
import { errorMessages } from "@/lib/reservations/errors";
import type { Room, Reservation } from "@/lib/reservations/types";
export function ReservationForm({
  rooms,
  existing,
  defaults = {},
  requestKey,
}: {
  rooms: Room[];
  existing?: Reservation;
  defaults?: {
    room?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  };
  requestKey: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const initial = existing?.room_bookings[0];
  function submit(form: FormData) {
    setError("");
    const input = {
      roomId: String(form.get("roomId")),
      checkIn: String(form.get("checkIn")),
      checkOut: String(form.get("checkOut")),
      guests: Number(form.get("guests")),
    };
    start(async () => {
      const result = existing
        ? await updateReservationAction({
            ...input,
            id: existing.id,
            version: existing.version,
          })
        : await createReservationAction({
            ...input,
            idempotencyKey: requestKey,
          });
      if (!result.ok) {
        setError(
          errorMessages[result.code] ||
            "Booking is not available right now. Please try again.",
        );
        return;
      }
      router.push("/reservations/" + result.data.id);
      router.refresh();
    });
  }
  return (
    <form action={submit} className="form-panel">
      <div className="form-grid">
        <label className="full">
          Your room
          <select
            name="roomId"
            defaultValue={initial?.room_id || defaults.room || rooms[0]?.id}
            required
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.room_types.name} · Room {room.room_number} · Up to{" "}
                {room.room_types.capacity} guests · ₱
                {Number(room.room_types.nightly_rate).toLocaleString("en-PH")}
                /night
              </option>
            ))}
          </select>
        </label>
        <label>
          Check-in
          <input
            type="date"
            name="checkIn"
            defaultValue={initial?.check_in || defaults.checkIn}
            required
          />
        </label>
        <label>
          Check-out
          <input
            type="date"
            name="checkOut"
            defaultValue={initial?.check_out || defaults.checkOut}
            required
          />
        </label>
        <label>
          Guests
          <input
            type="number"
            name="guests"
            min="1"
            max="20"
            defaultValue={existing?.guests || defaults.guests || "2"}
            required
          />
        </label>
      </div>
      <p className="subtle">
        This prototype accepts future check-in dates only. Saving creates a
        draft. Review the calculated price before submitting your booking
        request. Availability is reserved only after submission.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button
          className="primary"
          type="submit"
          disabled={pending || rooms.length === 0}
        >
          {pending
            ? "Saving…"
            : existing
              ? "Save changes"
              : "Save reservation draft"}
        </button>
        <Link className="button secondary" href="/reservations">
          Back to reservations
        </Link>
      </div>
    </form>
  );
}
