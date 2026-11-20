import { expect, it } from "vitest";
import {
  occupancy,
  periodSchema,
  daily,
  previousPeriod,
  revenueByRoomType,
  vatSplit,
  thisMonth,
  toCsv,
  totals,
} from "@/lib/reports";

it("counts occupied, reserved and sellable room-nights inside the period only", () => {
  const stays = [
    // Two of its nights fall before the period.
    {
      room_id: "a",
      check_in: "2026-10-30",
      check_out: "2026-11-03",
      status: "completed",
    },
    {
      room_id: "a",
      check_in: "2026-11-05",
      check_out: "2026-11-07",
      status: "checked_in",
    },
    {
      room_id: "b",
      check_in: "2026-11-02",
      check_out: "2026-11-04",
      status: "confirmed",
    },
    {
      room_id: "b",
      check_in: "2026-11-04",
      check_out: "2026-11-06",
      status: "cancelled",
    },
    // A room now out of service is not in roomIds.
    {
      room_id: "z",
      check_in: "2026-11-01",
      check_out: "2026-11-02",
      status: "completed",
    },
  ];
  const closures = [
    { room_id: "b", starts_on: "2026-11-08", ends_on: "2026-11-15" },
    { room_id: "b", starts_on: "2026-11-09", ends_on: "2026-11-11" },
  ];
  const o = occupancy("2026-11-01", "2026-11-10", ["a", "b"], stays, closures);
  // 2 rooms × 10 nights, minus Nov 8, 9, 10 closed on room b (overlaps count once).
  expect(o.sellable).toBe(17);
  expect(o.occupied).toBe(2 + 2);
  expect(o.reserved).toBe(2);
  expect(o.rate).toBeCloseTo(4 / 17);
  expect(occupancy("2026-11-01", "2026-11-01", [], [], []).rate).toBe(0);
});

it("defaults to the current month and rejects backwards or over-long periods", () => {
  expect(thisMonth("2026-02-14")).toEqual({
    from: "2026-02-01",
    to: "2026-02-28",
  });
  expect(thisMonth("2026-12-31")).toEqual({
    from: "2026-12-01",
    to: "2026-12-31",
  });
  expect(
    periodSchema.safeParse({ from: "2026-11-02", to: "2026-11-01" }).success,
  ).toBe(false);
  expect(
    periodSchema.safeParse({ from: "2026-01-01", to: "2027-06-01" }).success,
  ).toBe(false);
  expect(
    periodSchema.safeParse({ from: "2026-11-01", to: "2026-11-01" }).success,
  ).toBe(true);
});

it("totals payments by status", () => {
  const row = (status: string, amount: number) => ({
    date: "",
    kind: "Order" as const,
    reference: "",
    amount,
    method: "",
    status,
    recordedBy: "",
  });
  expect(
    totals([
      row("paid", 100),
      row("paid", 50.5),
      row("review", 20),
      row("refunded", 7),
    ]),
  ).toEqual({
    collected: 150.5,
    review: 20,
    refunded: 7,
  });
});

it("writes CSV that quotes commas and quotes and never starts a cell with a formula", () => {
  expect(
    toCsv(
      ["a", "b"],
      [
        ["x,y", 'say "hi"'],
        ["=HYPERLINK(1)", -5],
      ],
    ),
  ).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=HYPERLINK(1),-5\r\n');
});

it("sums revenue per room type: room and extras from payments, room charges, refunds and net", () => {
  const r = revenueByRoomType(
    ["Family Suite", "Garden Deluxe"],
    [
      { type: "Garden Deluxe", paid: 7400, extras: 1000 },
      // Money that does not cover the extras is counted as extras first.
      { type: "Garden Deluxe", paid: 500, extras: 800 },
      { type: "No room", paid: 0.1, extras: 0 },
      // A balance after a deposit that already covered the extras is all room.
      { type: "Family Suite", paid: 2000, extras: 600, paidBefore: 1000 },
      // A deposit smaller than the extras leaves the rest of the extras for the balance.
      { type: "Family Suite", paid: 3000, extras: 600, paidBefore: 400 },
    ],
    [{ type: "Garden Deluxe", amount: 300.2 }],
    [
      { type: "Garden Deluxe", amount: 360 },
      { type: "No room", amount: 0.2 },
    ],
  );
  expect(r.rows).toEqual([
    {
      roomType: "Family Suite",
      room: 4800,
      extras: 200,
      charges: 0,
      refunds: 0,
      net: 5000,
    },
    {
      roomType: "Garden Deluxe",
      room: 6400,
      extras: 1500,
      charges: 360,
      refunds: 300.2,
      net: 7959.8,
    },
    {
      roomType: "No room",
      room: 0.1,
      extras: 0,
      charges: 0.2,
      refunds: 0,
      net: 0.3,
    },
  ]);
  expect(r.total).toEqual({
    roomType: "Total",
    room: 11200.1,
    extras: 1700,
    charges: 360.2,
    refunds: 300.2,
    net: 12960.1,
  });
});

it("earns each stay night by night and counts money on the day it came in", () => {
  const rows = daily(
    "2026-11-01",
    "2026-11-03",
    ["a", "b"],
    [
      // Two nights at 1000 a night, one of them before the period.
      {
        room_id: "a",
        check_in: "2026-10-31",
        check_out: "2026-11-02",
        status: "completed",
        perNight: 1000,
      },
      // Confirmed stays earn too; cancelled ones never do.
      {
        room_id: "b",
        check_in: "2026-11-02",
        check_out: "2026-11-04",
        status: "confirmed",
        perNight: 500.5,
      },
      {
        room_id: "b",
        check_in: "2026-11-01",
        check_out: "2026-11-02",
        status: "cancelled",
        perNight: 900,
      },
    ],
    [{ room_id: "a", starts_on: "2026-11-03", ends_on: "2026-11-04" }],
    [
      { date: "2026-11-02", amount: 1001 },
      { date: "2026-11-02", amount: 99.5 },
    ],
  );
  expect(rows).toEqual([
    {
      date: "2026-11-01",
      occupied: 1,
      occupancy: 0.5,
      earned: 1000,
      collected: 0,
    },
    {
      date: "2026-11-02",
      occupied: 0,
      occupancy: 0,
      earned: 500.5,
      collected: 1100.5,
    },
    {
      date: "2026-11-03",
      occupied: 0,
      occupancy: 0,
      earned: 500.5,
      collected: 0,
    },
  ]);
});

it("splits VAT out of an inclusive amount and finds the period before", () => {
  expect(vatSplit(1120)).toEqual({ gross: 1120, net: 1000, vat: 120 });
  expect(vatSplit(0.01)).toEqual({ gross: 0.01, net: 0.01, vat: 0 });
  expect(previousPeriod("2026-11-01", "2026-11-30")).toEqual({
    from: "2026-10-02",
    to: "2026-10-31",
  });
  expect(previousPeriod("2026-03-01", "2026-03-01")).toEqual({
    from: "2026-02-28",
    to: "2026-02-28",
  });
});
