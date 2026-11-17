import { expect, it } from "vitest";
import { manilaDay, parseActivityFilter, shiftOf } from "@/lib/activity";
const row = (action: string, occurred_at: string) => ({
  id: action + occurred_at,
  action,
  record_id: "r",
  occurred_at,
});
it("the Manila day starts at 16:00 UTC the day before", () => {
  // 23:30 UTC on Nov 11 is 07:30 on Nov 12 in Manila.
  const late = manilaDay(new Date("2026-11-11T23:30:00Z"));
  expect(late.start.toISOString()).toBe("2026-11-11T16:00:00.000Z");
  expect(late.end.toISOString()).toBe("2026-11-12T16:00:00.000Z");
  // 15:59 UTC is still 23:59 the same Manila day; 16:00 UTC is the next day.
  expect(manilaDay(new Date("2026-11-12T15:59:59Z")).start.toISOString()).toBe(
    "2026-11-11T16:00:00.000Z",
  );
  expect(manilaDay(new Date("2026-11-12T16:00:00Z")).start.toISOString()).toBe(
    "2026-11-12T16:00:00.000Z",
  );
});
it("a shift starts at the first sign-in and counts later actions by type", () => {
  const s = shiftOf([
    row("order_created", "2026-11-11T16:30:00+00:00"),
    row("signed_in", "2026-11-12T00:00:00+00:00"),
    row("table_seated", "2026-11-12T01:00:00+00:00"),
    row("signed_in", "2026-11-12T02:00:00+00:00"),
    row("order_paid", "2026-11-12T03:00:00+00:00"),
    row("order_created", "2026-11-12T04:00:00+00:00"),
  ]);
  expect(s.signedInAt).toBe("2026-11-12T00:00:00+00:00");
  expect(s.actions.map((r) => r.action)).toEqual([
    "order_created",
    "order_paid",
    "table_seated",
  ]);
  expect(s.counts).toEqual([
    ["Orders", 2],
    ["Table bookings", 1],
  ]);
});
it("without a sign-in today the whole day counts", () => {
  const s = shiftOf([row("confirmed", "2026-11-11T17:00:00+00:00")]);
  expect(s.signedInAt).toBeNull();
  expect(s.counts).toEqual([["Room bookings", 1]]);
});
it("activity filters accept only known types and employee ids", () => {
  expect(
    parseActivityFilter({
      employee: "10000000-0000-4000-8000-000000000001",
      type: "tables",
      page: "3",
    }),
  ).toEqual({
    employee: "10000000-0000-4000-8000-000000000001",
    type: "tables",
    page: 3,
  });
  expect(
    parseActivityFilter({
      employee: "x' or 1=1",
      type: "constructor",
      page: "-2",
    }),
  ).toEqual({ employee: undefined, type: undefined, page: 1 });
  expect(
    parseActivityFilter({ type: ["tables", "orders"] }).type,
  ).toBeUndefined();
});
