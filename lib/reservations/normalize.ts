import type { Reservation } from "./types";
/** PostgREST embeds the PK/FK allocation as an object, not a collection. */
export function normalizeReservation(value: unknown): Reservation {
  const row = value as Omit<Reservation, "room_bookings"> & {
    room_bookings?:
      | Reservation["room_bookings"][number]
      | Reservation["room_bookings"]
      | null;
  };
  const allocation = row.room_bookings;
  return {
    ...row,
    room_bookings: Array.isArray(allocation)
      ? allocation
      : allocation
        ? [allocation]
        : [],
  };
}
