import { expect, test } from "vitest";
import { formatLabel } from "@/lib/format";

test("formatLabel turns stored values into display labels", () => {
  expect(formatLabel("checked_in")).toBe("Checked in");
  expect(formatLabel("guest_booking_created")).toBe("Guest booking created");
  expect(formatLabel("staff")).toBe("Staff");
  expect(formatLabel("")).toBe("");
});
