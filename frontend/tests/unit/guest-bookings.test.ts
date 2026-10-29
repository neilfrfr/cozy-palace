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
vi.mock("@/lib/email", () => ({ sendBookingLink: mocks.send }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => mocks.headers.get(k) ?? null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error("REDIRECT " + to);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
  adminConfigured: () => mocks.configured,
}));
const token = "a".repeat(64);
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
    data: { token, reference: "CP-ABC" },
    error: null,
  });
});
it("books through the server with the visitor's IP and returns the private link token", async () => {
  const { bookAsGuestAction } = await import("@/app/actions/guest-bookings");
  mocks.headers.set("x-real-ip", "203.0.113.7");
  expect(await bookAsGuestAction(input, "captcha-token")).toEqual({
    ok: true,
    data: { token },
  });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "book_as_guest",
    expect.objectContaining({
      p_client_ip: "203.0.113.7",
      p_guest_email: "walk@example.test",
    }),
  );
});
it("refuses a failed CAPTCHA before touching the database, and emails the link after booking", async () => {
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
      link: "http://localhost:3000/stay/" + token,
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
it("cancels only with a well-formed link token", async () => {
  const { cancelGuestBookingAction } =
    await import("@/app/actions/guest-bookings");
  const form = (t: string) => {
    const f = new FormData();
    f.set("token", t);
    return f;
  };
  expect(await cancelGuestBookingAction(null, form("../etc"))).toEqual({
    code: "NOT_FOUND",
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
  await expect(cancelGuestBookingAction(null, form(token))).rejects.toThrow(
    "REDIRECT /stay/" + token,
  );
  expect(mocks.rpc).toHaveBeenCalledWith("cancel_guest_booking", {
    p_token: token,
  });
});
it("the booking page 404s for malformed or unknown links", async () => {
  const { default: Stay } = await import("@/app/stay/[token]/page");
  await expect(
    Stay({ params: Promise.resolve({ token: "short" }) }),
  ).rejects.toThrow("NOT_FOUND");
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "NOT_FOUND" },
  });
  await expect(Stay({ params: Promise.resolve({ token }) })).rejects.toThrow(
    "NOT_FOUND",
  );
});
