import { describe, expect, it } from "vitest";
import { isValidPhone, phoneError, splitPhoneNumber } from "@/lib/phone";
import { guestSchema } from "@/lib/operations/schema";

describe("guest phone rules", () => {
  it.each([
    "+639171234567",
    "+6591234567",
    "+12025550143",
    "+447911123456",
    "+61412345678",
    "+919876543210",
  ])("accepts %s", (n) => expect(isValidPhone(n)).toBe(true));

  it.each([
    ["+631435726378", "Philippine numbers must start with 9"],
    ["+63917123456", "too short"],
    ["+6571234567", "Singapore numbers can't start with 7"],
    ["+10125550143", "US area codes can't start with 0"],
    ["+440791112345", "UK numbers drop the trunk 0"],
    ["+61512345678", "Australian numbers can't start with 5"],
    ["+915876543210", "Indian mobiles start with 6-9"],
    ["+999123456789", "unknown country code"],
  ])("rejects %s (%s)", (n) => expect(isValidPhone(n)).toBe(false));

  it("explains the rule that a number breaks", () => {
    expect(phoneError("+63", "1435726378")).toMatch(/start with 9/);
    expect(phoneError("+63", "9171234567")).toBe("");
  });

  it("splits stored numbers by the longest matching code", () => {
    expect(splitPhoneNumber("+639171234567")).toEqual({
      countryCode: "+63",
      digits: "9171234567",
    });
  });

  it("guest bookings reject phone numbers that break the country rules", () => {
    const base = {
      roomId: "10000000-0000-4000-8000-000000000001",
      checkIn: "2027-06-01",
      checkOut: "2027-06-03",
      guests: 2,
      guestFullName: "Guest",
      idempotencyKey: "10000000-0000-4000-8000-0000000000aa",
    };
    expect(guestSchema.safeParse({ ...base, guestPhone: "+631435726378" }).success).toBe(false);
    expect(guestSchema.safeParse({ ...base, guestPhone: "+639171234567" }).success).toBe(true);
    expect(guestSchema.safeParse({ ...base, guestPhone: "" }).success).toBe(true);
  });
});
