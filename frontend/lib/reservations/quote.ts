import type { createClient } from "@/lib/supabase/server";
import {
  priceExtras,
  type BookedExtra,
  type Extra,
  type ExtrasInput,
} from "@/lib/extras";
/** Current nightly rate and display name of a bookable room. The database re-checks both on booking. */
export async function roomQuote(
  db: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  roomId: string,
  guests: number,
): Promise<
  { ok: true; rate: number; room: string } | { ok: false; code: string }
> {
  const { data: room, error } = await db
    .from("rooms")
    .select(
      "room_number,operational_state,room_types(name,nightly_rate,capacity)",
    )
    .eq("id", roomId)
    .maybeSingle();
  if (error || !room || room.operational_state !== "available")
    return { ok: false, code: "RESOURCE_UNAVAILABLE" };
  const type = room.room_types as unknown as {
    name: string;
    nightly_rate: number;
    capacity: number;
  };
  if (guests > type.capacity) return { ok: false, code: "CAPACITY_EXCEEDED" };
  return {
    ok: true,
    rate: Number(type.nightly_rate),
    room: `${type.name} · Room ${room.room_number}`,
  };
}
export const nights = (checkIn: string, checkOut: string) =>
  (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
/** Current prices of the chosen extras, for the review step. The database prices them again on booking. */
export async function extrasQuote(
  db: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  chosen: ExtrasInput,
  nights: number,
): Promise<BookedExtra[] | null> {
  if (!chosen.length) return [];
  const { data, error } = await db
    .from("extras")
    .select("id,name,price,pricing,max_quantity,active")
    .in(
      "id",
      chosen.map((c) => c.id),
    );
  if (error) return null;
  return priceExtras(chosen, data as Extra[], nights);
}
