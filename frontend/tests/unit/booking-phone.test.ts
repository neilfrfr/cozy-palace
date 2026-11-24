import { beforeEach, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
import { ensureBookingPhone, takePhone } from "@/lib/accounts/booking-phone";

let profile: { full_name: string; phone: string | null } | null;
const db = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
  }),
  rpc: vi.fn(),
};
const check = (given: unknown) =>
  ensureBookingPhone(db as never, "user-1", given);
beforeEach(() => {
  db.rpc.mockReset().mockResolvedValue({ error: null });
});

it("lets an account that already has a phone book without asking again", async () => {
  profile = { full_name: "Ana", phone: "+639171234567" };
  expect(await check(undefined)).toBeNull();
  expect(db.rpc).not.toHaveBeenCalled();
});

it("refuses a booking from an account with no phone unless a valid one is given", async () => {
  profile = { full_name: "Ana", phone: "" };
  for (const given of [undefined, "", "12", "+631435726378"])
    expect(await check(given)).toBe("PHONE_REQUIRED");
  expect(db.rpc).not.toHaveBeenCalled();
});

it("saves the phone given with the booking to the account", async () => {
  profile = { full_name: "Ana", phone: null };
  expect(await check(" +639171234567 ")).toBeNull();
  expect(db.rpc).toHaveBeenCalledWith("update_profile", {
    p_name: "Ana",
    p_phone: "+639171234567",
  });
});

it("splits the phone off the booking so the strict schema still applies", () => {
  expect(takePhone({ roomId: "r", guestPhone: "+639171234567" })).toEqual([
    { roomId: "r" },
    "+639171234567",
  ]);
  expect(takePhone(null)).toEqual([null, undefined]);
});
