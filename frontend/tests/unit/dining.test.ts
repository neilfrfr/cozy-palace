import { describe, it, expect } from "vitest";
import {
  diningSlots,
  slotStart,
  tableBookingSchema,
  walkInSchema,
} from "@/lib/dining";
const valid = {
  tableId: "10000000-0000-4000-8000-000000000001",
  date: "2026-11-04",
  time: "19:00",
  guests: 2,
  idempotencyKey: "20000000-0000-4000-8000-000000000001",
};
describe("dining slots", () => {
  it("covers lunch and dinner every half hour, matching the database rule", () => {
    expect(diningSlots.slice(0, 3)).toEqual(["11:00", "11:30", "12:00"]);
    expect(diningSlots).toContain("14:00");
    expect(diningSlots).not.toContain("14:30");
    expect(diningSlots).not.toContain("16:30");
    expect(diningSlots.at(-1)).toBe("21:00");
    expect(diningSlots).toHaveLength(16);
  });
  it("builds Manila start times", () =>
    expect(new Date(slotStart("2026-11-04", "19:00")).toISOString()).toBe(
      "2026-11-04T11:00:00.000Z",
    ));
});
describe("table booking input", () => {
  it("accepts a valid request", () =>
    expect(tableBookingSchema.safeParse(valid).success).toBe(true));
  it.each([
    { time: "19:15" },
    { time: "15:00" },
    { date: "2026-02-30" },
    { guests: 0 },
    { guests: 21 },
    { tableId: "T1" },
    { guestFullName: "Someone" },
  ])("rejects %j", (change) =>
    expect(tableBookingSchema.safeParse({ ...valid, ...change }).success).toBe(
      false,
    ),
  );
  it("requires a guest name for walk-ins", () => {
    expect(walkInSchema.safeParse(valid).success).toBe(false);
    expect(
      walkInSchema.safeParse({ ...valid, guestFullName: "Walk-in Party" })
        .success,
    ).toBe(true);
  });
});
