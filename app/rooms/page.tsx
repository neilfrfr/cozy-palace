import Link from "next/link";
import { isConfigured } from "@/lib/supabase/config";
import { getRooms } from "@/lib/reservations/service";
import { SetupNotice } from "@/components/setup-notice";
import { z } from "zod";
export const dynamic = "force-dynamic";
export default async function Rooms({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const configured = isConfigured();
  let rooms: Awaited<ReturnType<typeof getRooms>> = [];
  let error = "";
  const filters = z
    .object({
      checkIn: z.iso.date(),
      checkOut: z.iso.date(),
      guests: z.coerce.number().int().min(1).max(20),
    })
    .refine((v) => v.checkOut > v.checkIn)
    .safeParse(p);
  if (configured) {
    try {
      rooms = await getRooms(filters.success ? filters.data : undefined);
    } catch {
      error = "We could not load the rooms. Please refresh and try again.";
    }
  }
  return (
    <>
      <h1>Find your place to unwind</h1>
      <p className="intro">
        Choose your dates and the people joining you. Availability is checked
        again when you submit your request.
      </p>
      {!configured && <SetupNotice />}
      <form className="search" action="/rooms">
        <label>
          Check-in
          <input type="date" name="checkIn" required defaultValue={p.checkIn} />
        </label>
        <label>
          Check-out
          <input
            type="date"
            name="checkOut"
            required
            defaultValue={p.checkOut}
          />
        </label>
        <label>
          Guests
          <input
            type="number"
            name="guests"
            min="1"
            max="20"
            defaultValue={p.guests || "2"}
            required
          />
        </label>
        <button className="primary" type="submit" disabled={!configured}>
          Check availability
        </button>
      </form>
      {configured && p.checkIn && !filters.success && (
        <div className="notice error" role="alert">
          Choose valid dates with check-out after check-in, and a whole number
          of guests.
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {configured && (
        <p className="subtle">
          Fictional prototype inventory and rates. Not a commercial booking
          offer.
        </p>
      )}
      <div className="grid">
        {rooms.map((room) => (
          <article className="room" key={room.id}>
            <div className="room-number">
              Room {room.room_number} · Up to {room.room_types.capacity} guests
            </div>
            <h2>{room.room_types.name}</h2>
            <p>{room.room_types.description}</p>
            <div className="price">
              ₱{Number(room.room_types.nightly_rate).toLocaleString("en-PH")}{" "}
              <small>/ night</small>
            </div>
            <div className="room-bottom">
              <Link
                className="button secondary"
                href={
                  "/reservations/new?" +
                  new URLSearchParams({
                    room: room.id,
                    ...(filters.success
                      ? {
                          checkIn: filters.data.checkIn,
                          checkOut: filters.data.checkOut,
                          guests: String(filters.data.guests),
                        }
                      : {}),
                  })
                }
              >
                Choose room
              </Link>
            </div>
          </article>
        ))}
      </div>
      {configured && !error && rooms.length === 0 && (
        <div className="empty">
          <h2>No rooms found for this search.</h2>
          <p>Try different dates or a smaller guest count.</p>
        </div>
      )}
    </>
  );
}
