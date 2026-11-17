import { expect, test } from "vitest";
import { formatLabel, normalizeReference } from "@/lib/format";

test("formatLabel turns stored values into display labels", () => {
  expect(formatLabel("checked_in")).toBe("Checked in");
  expect(formatLabel("guest_booking_created")).toBe("Guest booking created");
  expect(formatLabel("staff")).toBe("Staff");
  expect(formatLabel("")).toBe("");
});

test("normalizeReference reads new numbers and keeps old codes", () => {
  expect(normalizeReference("42")).toBe("42");
  expect(normalizeReference(" #0042 ")).toBe("42");
  expect(normalizeReference("0")).toBe("0");
  expect(normalizeReference("cp-819c8bcd0f05")).toBe("CP-819C8BCD0F05");
  expect(normalizeReference("OR-ABC")).toBe("OR-ABC");
  expect(normalizeReference("")).toBe("");
});
