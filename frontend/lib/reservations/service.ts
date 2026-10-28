import { normalizeReservation } from "./normalize";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer, requireStaff } from "@/lib/auth/authorize";
import type { Room, Reservation } from "./types";
import {
  addDays,
  bookedNights,
  fullyBookedNights,
  type BookedRange,
} from "./availability";
import { businessDate } from "@/lib/operations/schema";
/** Nights with no room left at all, for the public availability search. */
export async function getFullyBookedNights(): Promise<string[]> {
  try {
    const [rooms, ranges] = await Promise.all([
      getRooms(),
      getBookedRanges(businessDate()),
    ]);
    return [
      ...fullyBookedNights(
        ranges,
        rooms.map((r) => r.id),
      ),
    ];
  } catch {
    return [];
  }
}
/** Booked nights per room id, for forms where a specific room is chosen. */
export async function getBookedNightsByRoom(
  rooms: Room[],
  excludeReservation?: string,
): Promise<Record<string, string[]>> {
  const ranges = await getBookedRanges(businessDate(), excludeReservation);
  return Object.fromEntries(
    rooms.map((r) => [r.id, [...bookedNights(ranges, r.id)]]),
  );
}
/**
 * Booked nights for the next year, used to grey out dates in the calendars.
 * Returns an empty list if the database doesn't have the function yet, so the
 * calendars still work without greyed-out dates.
 */
export async function getBookedRanges(
  from: string,
  excludeReservation?: string,
): Promise<BookedRange[]> {
  const db = await createClient();
  const { data, error } = await db.rpc("room_booked_ranges", {
    p_from: from,
    p_to: addDays(from, 366),
    p_exclude_reservation: excludeReservation ?? null,
  });
  if (error) return [];
  return (data ?? []).map(
    (r: { room_id: string; check_in: string; check_out: string }) => ({
      roomId: r.room_id,
      checkIn: r.check_in,
      checkOut: r.check_out,
    }),
  );
}
export async function getRooms(filter?: {
  checkIn: string;
  checkOut: string;
  guests: number;
}): Promise<Room[]> {
  const db = await createClient();
  let ids: string[] | undefined;
  if (filter) {
    const { data, error } = await db.rpc("search_availability", {
      p_check_in: filter.checkIn,
      p_check_out: filter.checkOut,
      p_guests: filter.guests,
    });
    if (error)
      throw new Error("Could not check availability. Please try again.");
    ids = (data ?? []).map((r: { id: string }) => r.id);
    if (ids!.length === 0) return [];
  }
  let query = db
    .from("rooms")
    .select(
      "id,room_number,room_types(id,code,name,description,capacity,nightly_rate)",
    )
    .eq("operational_state", "available")
    .order("room_number");
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error("Rooms could not be loaded. Please try again.");
  return data as unknown as Room[];
}
export async function getReservations(staff = false): Promise<Reservation[]> {
  const { db, userId } = staff ? await requireStaff() : await requireCustomer();
  let query = db
    .from("reservations")
    .select("*,room_bookings(*)")
    .eq("kind", "hotel")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!staff) query = query.eq("customer_id", userId);
  const { data, error } = await query;
  if (error)
    throw new Error("Reservations could not be loaded. Please try again.");
  return (data ?? []).map(normalizeReservation);
}
export async function getReservation(id: string): Promise<Reservation | null> {
  const { db, userId } = await requireCustomer();
  const { data, error } = await db
    .from("reservations")
    .select("*,room_bookings(*)")
    .eq("id", id)
    .eq("customer_id", userId)
    .maybeSingle();
  if (error) throw new Error("Reservation could not be loaded.");
  return data ? normalizeReservation(data) : null;
}
export async function getActivity(page = 1) {
  const { db } = await requireStaff(true);
  const from = (page - 1) * 25;
  const { data, error } = await db
    .from("audit_logs")
    .select("id,actor_id,actor_name,actor_role,action,record_id,occurred_at")
    .order("occurred_at", { ascending: false })
    .range(from, from + 24);
  if (error) throw new Error("Activity could not be loaded.");
  return data ?? [];
}
