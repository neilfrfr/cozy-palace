import { expect, it } from "vitest";
import {
  bookingsByDay,
  collectedByMonth,
  movesToday,
  roomsTonight,
} from "@/lib/operations/overview";

const today = "2026-11-25";

it("counts each room once tonight: guest in, then booked, then closed, else free", () => {
  const rooms = ["a", "b", "c", "d", "e"].map((id) => ({
    id,
    operational_state: id === "d" ? "out_of_service" : "available",
  }));
  const stay = (
    room_id: string,
    check_in: string,
    check_out: string,
    status: string,
  ) => ({ room_id, check_in, check_out, status });
  const counts = roomsTonight(
    today,
    rooms,
    [
      stay("a", "2026-11-24", "2026-11-27", "checked_in"),
      stay("a", "2026-11-25", "2026-11-26", "confirmed"), // a stray double booking still counts the room once
      stay("b", today, "2026-11-26", "pending"),
      stay("c", "2026-11-23", today, "checked_in"), // leaves today, so free tonight
      stay("e", today, "2026-11-26", "cancelled"),
    ],
    [{ room_id: "c", starts_on: "2026-11-26", ends_on: "2026-11-28" }], // closes tomorrow, not tonight
  );
  expect(counts).toEqual({ occupied: 1, reserved: 1, available: 2, closed: 1 });
});

it("counts today's arrivals and departures and how many have happened", () => {
  const s = (check_in: string, check_out: string, status: string) => ({
    room_id: "r",
    check_in,
    check_out,
    status,
  });
  expect(
    movesToday(today, [
      s(today, "2026-11-27", "confirmed"),
      s(today, "2026-11-27", "checked_in"),
      s(today, "2026-11-27", "cancelled"),
      s("2026-11-23", today, "completed"),
      s("2026-11-22", today, "checked_in"),
    ]),
  ).toEqual({ checkIns: 2, arrived: 1, checkOuts: 2, left: 1 });
});

it("groups new bookings by the Manila day they were made", () => {
  const days = bookingsByDay(today, 7, [
    { kind: "hotel", created_at: "2026-11-24T16:30:00Z" }, // 00:30 on the 25th in Manila
    { kind: "dining", created_at: "2026-11-25T03:00:00Z" },
    { kind: "hotel", created_at: "2026-11-19T01:00:00Z" },
    { kind: "hotel", created_at: "2026-11-18T01:00:00Z" }, // before the window
  ]);
  expect(days).toHaveLength(7);
  expect(days[0]).toEqual({ date: "2026-11-19", rooms: 1, tables: 0 });
  expect(days[6]).toEqual({ date: today, rooms: 1, tables: 1 });
});

it("totals money per month and compares this month with the same days of last month", () => {
  const r = collectedByMonth(today, 3, [
    { paid_at: "2026-11-10T02:00:00Z", amount: 1200 },
    { paid_at: "2026-10-05T02:00:00Z", amount: 1000 },
    { paid_at: "2026-10-28T02:00:00Z", amount: 5000 }, // after the 25th: not in the comparison
    { paid_at: "2026-09-30T17:00:00Z", amount: 300 }, // 1 October in Manila
    { paid_at: "2026-08-15T02:00:00Z", amount: 999 }, // outside the window
  ]);
  expect(r.months).toEqual([
    { month: "2026-09", amount: 0 },
    { month: "2026-10", amount: 6300 },
    { month: "2026-11", amount: 1200 },
  ]);
  expect(r.soFar).toBe(1200);
  expect(r.change).toBeCloseTo(1200 / 1300 - 1);
  expect(collectedByMonth(today, 2, []).change).toBeNull();
});
