import { expect, it } from "vitest";
import { businessDate, guestCanCancel } from "@/lib/operations/schema";

it("lets guests cancel until two days before the date, in Manila time", () => {
  expect(guestCanCancel("2026-11-14", "2026-11-12")).toBe(true);
  expect(guestCanCancel("2026-11-13", "2026-11-12")).toBe(false);
  expect(guestCanCancel("2026-11-12", "2026-11-12")).toBe(false);
  expect(guestCanCancel("2026-11-01", "2026-11-12")).toBe(false);
  expect(guestCanCancel("2027-01-01", "2026-12-30")).toBe(true);
  expect(guestCanCancel("", "2026-11-12")).toBe(false);
  // 23:59 Manila on the 12th is still the 12th; one minute later it is the 13th.
  expect(businessDate(new Date("2026-11-12T15:59:00Z"))).toBe("2026-11-12");
  expect(businessDate(new Date("2026-11-12T16:00:00Z"))).toBe("2026-11-13");
});
