import { describe, it, expect } from "vitest";
import { reservationSchema } from "@/lib/reservations/schema";
import { safeRedirect } from "@/lib/auth/redirect";
import { publicError } from "@/lib/reservations/errors";
const valid = {
  roomId: "10000000-0000-4000-8000-000000000001",
  checkIn: "2026-11-01",
  checkOut: "2026-11-03",
  guests: 2,
  idempotencyKey: "20000000-0000-4000-8000-000000000001",
};
describe("reservation input", () => {
  it("accepts valid dates and whole guests", () =>
    expect(reservationSchema.safeParse(valid).success).toBe(true));
  it.each([
    { checkOut: "2026-11-01" },
    { checkOut: "2026-10-31" },
    { checkIn: "2026-02-30" },
    { guests: 1.5 },
    { guests: 0 },
    { roomId: "no" },
    { idempotencyKey: "bad" },
  ])("rejects invalid input %j", (change) =>
    expect(reservationSchema.safeParse({ ...valid, ...change }).success).toBe(
      false,
    ),
  );
  it("rejects authority and price injection", () =>
    expect(
      reservationSchema.safeParse({ ...valid, total: 1, customerId: "another" })
        .success,
    ).toBe(false));
});
describe("login redirect", () => {
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "javascript:alert(1)",
    "/login\nLocation:evil",
  ])("rejects %s", (p) => expect(safeRedirect(p)).toBe("/reservations"));
  it("preserves a local booking destination", () =>
    expect(safeRedirect("/reservations/new?room=123")).toBe(
      "/reservations/new?room=123",
    ));
});
describe("safe database errors", () => {
  it("maps exclusion violations", () =>
    expect(publicError({ code: "23P01", message: "private SQL" })).toBe(
      "AVAILABILITY_CONFLICT",
    ));
  it("does not expose SQL", () =>
    expect(publicError({ message: "secret host=password" })).toBe(
      "REQUEST_FAILED",
    ));
  it("returns known business errors", () =>
    expect(publicError({ message: "VERSION_CONFLICT" })).toBe(
      "VERSION_CONFLICT",
    ));
});
