import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  headers: new Map<string, string>(),
  configured: true,
  captcha: true,
  send: vi.fn(),
}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("@/lib/captcha", () => ({
  visitorBookingEnabled: () => mocks.configured,
  verifyCaptcha: async () => mocks.captcha,
}));
vi.mock("@/lib/email", () => ({ sendBookingEmail: mocks.send }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => mocks.headers.get(k) ?? null }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
  adminConfigured: () => mocks.configured,
}));
const input = {
  roomId: "10000000-0000-4000-8000-000000000001",
  checkIn: "2027-01-10",
  checkOut: "2027-01-12",
  guests: 2,
  guestFullName: "Walk In",
  guestEmail: "walk@example.test",
  guestPhone: "+639171234567",
  idempotencyKey: "20000000-0000-4000-8000-000000000001",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.clear();
  mocks.configured = true;
  mocks.captcha = true;
  mocks.rpc.mockResolvedValue({
    data: { id: "30000000-0000-4000-8000-000000000001", reference: "CP-ABC" },
    error: null,
  });
});
it("books through the server with the visitor's IP and returns only the reference", async () => {
  const { bookAsGuestAction } = await import("@/app/actions/guest-bookings");
  mocks.headers.set("x-real-ip", "203.0.113.7");
  expect(await bookAsGuestAction(input, "captcha-token")).toEqual({
    ok: true,
    data: { reference: "CP-ABC" },
  });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "book_as_guest",
    expect.objectContaining({
      p_client_ip: "203.0.113.7",
      p_guest_email: "walk@example.test",
    }),
  );
});
it("refuses a failed CAPTCHA before touching the database, and emails the details after booking", async () => {
  const { bookAsGuestAction } = await import("@/app/actions/guest-bookings");
  mocks.captcha = false;
  expect(await bookAsGuestAction(input, "bad")).toMatchObject({
    ok: false,
    code: "CAPTCHA_FAILED",
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
  mocks.captcha = true;
  await bookAsGuestAction(input, "good");
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "walk@example.test",
      reference: "CP-ABC",
      booking: "a stay from 2027-01-10 to 2027-01-12",
      id: "30000000-0000-4000-8000-000000000001",
    }),
  );
});
it("requires email and phone, and stays off without the server key", async () => {
  const { bookAsGuestAction } = await import("@/app/actions/guest-bookings");
  expect(
    await bookAsGuestAction({ ...input, guestEmail: "" }, "captcha-token"),
  ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  expect(
    await bookAsGuestAction({ ...input, guestPhone: "" }, "captcha-token"),
  ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  mocks.configured = false;
  expect(await bookAsGuestAction(input, "captcha-token")).toMatchObject({
    ok: false,
    code: "REQUEST_FAILED",
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("passes database refusals through as public codes", async () => {
  const { bookAsGuestAction } = await import("@/app/actions/guest-bookings");
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "RATE_LIMITED" },
  });
  expect(await bookAsGuestAction(input, "captcha-token")).toMatchObject({
    ok: false,
    code: "RATE_LIMITED",
  });
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "secret detail" },
  });
  expect(await bookAsGuestAction(input, "captcha-token")).toMatchObject({
    ok: false,
    code: "REQUEST_FAILED",
  });
});
it("a visitor books a table with contact details and a CAPTCHA, and is emailed the details", async () => {
  const { bookTableAsGuestAction } =
    await import("@/app/actions/guest-bookings");
  const table = {
    tableId: "40000000-0000-4000-8000-000000000001",
    date: "2027-01-10",
    time: "19:00",
    guests: 2,
    guestFullName: "Walk In",
    guestEmail: "walk@example.test",
    guestPhone: "+639171234567",
    idempotencyKey: "20000000-0000-4000-8000-000000000002",
  };
  expect(
    await bookTableAsGuestAction({ ...table, guestEmail: "" }, "captcha-token"),
  ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  mocks.captcha = false;
  expect(await bookTableAsGuestAction(table, "bad")).toMatchObject({
    ok: false,
    code: "CAPTCHA_FAILED",
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.captcha = true;
  expect(await bookTableAsGuestAction(table, "good")).toEqual({
    ok: true,
    data: { reference: "CP-ABC" },
  });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "book_table_as_guest",
    expect.objectContaining({ p_start_at: "2027-01-10T19:00:00+08:00" }),
  );
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({ booking: "a table on 2027-01-10 at 19:00" }),
  );
});
