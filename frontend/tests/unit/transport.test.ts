import { it, expect } from "vitest";
import { normalizeReservation } from "@/lib/reservations/normalize";
it("normalizes a PostgREST one-to-one allocation object for persistent details and edits", () => {
  const allocation = {
    room_id: "10000000-0000-4000-8000-000000000002",
    check_in: "2027-01-01",
    check_out: "2027-01-03",
    rate_at_booking: 5800,
  };
  const r = normalizeReservation({
    id: "reservation",
    room_bookings: allocation,
  });
  expect(r.room_bookings[0]).toEqual(allocation);
});
it("normalizes an absent allocation to an empty collection", () =>
  expect(normalizeReservation({ room_bookings: null }).room_bookings).toEqual(
    [],
  ));
