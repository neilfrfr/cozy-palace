import { RoomCard } from "@/components/room-card";
import { AvailabilitySearch } from "@/components/availability-search";
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
      <h1>Find Your Place to Unwind</h1>
      <p className="intro">
        Choose your dates and who is joining you. We’ll check availability
        again when you submit your reservation request.
      </p>
      {!configured && <SetupNotice />}
      <AvailabilitySearch configured={configured} defaults={p} />
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
          <RoomCard
            key={room.id}
            room={room}
            query={
              filters.success
                ? new URLSearchParams({
                    checkIn: filters.data.checkIn,
                    checkOut: filters.data.checkOut,
                    guests: String(filters.data.guests),
                  }).toString()
                : ""
            }
          />
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
