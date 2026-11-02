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

export const isPaid = (r: Reservation) =>
  !!r.payments?.some((p) => p.status === "paid");

/** Mirrors open_payment: submitted (held) or confirmed, with a total, not yet paid. The database re-checks. */
export function canPayOnline(r: Reservation, now = new Date()) {
  return (
    !isPaid(r) &&
    Number(r.total) > 0 &&
    (r.status === "confirmed" ||
      (r.status === "pending" && new Date(r.hold_expires_at ?? 0) > now))
  );
}
