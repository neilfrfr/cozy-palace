import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ adminConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const mail = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock("nodemailer", () => ({ createTransport: mail.createTransport }));
const fetchMock = vi.fn();
beforeEach(() => {
  mail.createTransport.mockClear();
  mail.sendMail.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("verifies the CAPTCHA with Cloudflare and fails closed", async () => {
  const { verifyCaptcha, visitorBookingEnabled } =
    await import("@/lib/captcha");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
  expect(visitorBookingEnabled()).toBe(false);
  expect(await verifyCaptcha("token", "1.2.3.4", "book_room")).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
  vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  expect(visitorBookingEnabled()).toBe(true);
  vi.stubEnv("VERCEL_ENV", "production");
  expect(visitorBookingEnabled()).toBe(false);
  vi.stubEnv("VERCEL_ENV", "preview");
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true })),
  );
  expect(
    await verifyCaptcha("XXXX.DUMMY.TOKEN.XXXX", "1.2.3.4", "book_room"),
  ).toBe(true);
  const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
  expect(body.get("response")).toBe("XXXX.DUMMY.TOKEN.XXXX");
  expect(body.get("remoteip")).toBe("1.2.3.4");
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ success: false })),
  );
  expect(await verifyCaptcha("used", "1.2.3.4", "book_room")).toBe(false);
  fetchMock.mockRejectedValueOnce(new Error("network"));
  expect(await verifyCaptcha("any", "1.2.3.4", "book_room")).toBe(false);
  expect(await verifyCaptcha("", "1.2.3.4", "book_room")).toBe(false);
});
it("with a real secret, needs the hostname list and checks the action and hostname", async () => {
  const { verifyCaptcha, visitorBookingEnabled } =
    await import("@/lib/captcha");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "0x4AAAAAAAreal-secret");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "0x4AAAAAAAsite");
  vi.stubEnv("TURNSTILE_HOSTNAMES", "");
  expect(visitorBookingEnabled()).toBe(false);
  vi.stubEnv("TURNSTILE_HOSTNAMES", "cozy.example, preview.example");
  expect(visitorBookingEnabled()).toBe(true);
  const answer = (action: string, hostname: string) =>
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, action, hostname })),
    );
  answer("book_room", "preview.example");
  expect(await verifyCaptcha("t", "1.2.3.4", "book_room")).toBe(true);
  answer("book_table", "cozy.example");
  expect(await verifyCaptcha("t", "1.2.3.4", "book_room")).toBe(false);
  answer("book_room", "evil.example");
  expect(await verifyCaptcha("t", "1.2.3.4", "book_room")).toBe(false);
});
it("emails a notice with the guest's name escaped, and reports why a send failed", async () => {
  const { sendEmail } = await import("@/lib/email");
  const { emailFor } = await import("@/lib/notifications");
  const message = emailFor(
    { id: "n1", event: "confirmed", email: "walk@example.test" },
    {
      reference: "42",
      kind: "hotel",
      guests: 2,
      guest_full_name: "<script>x</script>",
      customer: null,
      room_bookings: [{ check_in: "2027-01-10", check_out: "2027-01-12" }],
      table_bookings: [],
    },
  );
  expect(await sendEmail(message)).toBe("Email is not configured");
  expect(mail.createTransport).not.toHaveBeenCalled();
  vi.stubEnv("GMAIL_USER", "cozypalace.bookings@gmail.com");
  vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
  mail.sendMail.mockResolvedValueOnce({});
  expect(await sendEmail(message)).toBeNull();
  expect(mail.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      auth: { user: "cozypalace.bookings@gmail.com", pass: "abcdefghijklmnop" },
    }),
  );
  const sent = mail.sendMail.mock.calls[0][0];
  expect(sent.to).toBe("walk@example.test");
  expect(sent.subject).toBe("Your booking is confirmed · Booking 42");
  expect(sent.messageId).toBe("<notice-n1@cozypalace>");
  expect(sent.html).toContain("&lt;script&gt;");
  expect(sent.html).not.toContain("<script>");
  expect(sent.text).toContain(
    "Booking 42: a stay from 2027-01-10 to 2027-01-12, 2 guests",
  );
  expect(sent.text).not.toContain("http");
  const refund = emailFor(
    { id: "n2", event: "refunded", email: "walk@example.test" },
    {
      reference: "42",
      kind: "hotel",
      guests: 2,
      guest_full_name: "Ana",
      customer: null,
      room_bookings: [],
      table_bookings: [],
    },
  );
  expect(refund.subject).toBe("Your payment was refunded · Booking 42");
  expect(refund.lines.join(" ")).not.toContain("change or cancel");
  vi.spyOn(console, "error").mockImplementation(() => {});
  mail.sendMail.mockRejectedValueOnce(new Error("535 bad credentials"));
  expect(await sendEmail(message)).toBe("535 bad credentials");
});
it("purchase emails describe the extras, the order, or the amount", async () => {
  const { emailFor } = await import("@/lib/notifications");
  const booking = {
    reference: "42",
    kind: "hotel" as const,
    guests: 2,
    guest_full_name: "Ana",
    customer: null,
    room_bookings: [{ check_in: "2027-01-10", check_out: "2027-01-12" }],
    table_bookings: [],
    reservation_extras: [
      {
        name: "Breakfast",
        unit_price: 250,
        pricing: "per_night" as const,
        quantity: 2,
        line_total: 1000,
      },
    ],
  };
  const text = (event: Parameters<typeof emailFor>[0]["event"], d = {}) =>
    emailFor(
      { id: "n", event, email: "a@example.test" },
      booking,
      d,
    ).lines.join(" ");
  expect(text("received")).toContain("2 guests with Breakfast × 2 (₱1,000)");
  expect(text("received")).toContain("change or cancel");
  const order = {
    reference: "57",
    status: "completed",
    total: 710,
    paid_at: null,
    rooms: { room_number: "101" },
    order_items: [
      { name: "Halo-halo", quantity: 2 },
      { name: "Premium Wine", quantity: 1 },
    ],
  };
  expect(text("room_charge", { order })).toContain(
    "Order 57: 2 × Halo-halo, 1 × Premium Wine. Total ₱710.00. It is added to your room bill for room 101",
  );
  expect(text("order_updated", { order })).toContain("Status: Completed.");
  expect(text("order_placed", { order: { ...order, rooms: null } })).toContain(
    "We recorded your order",
  );
  expect(text("paid", { amount: 7400 })).toContain("₱7,400.00 was paid online");
  expect(text("partially_refunded", { amount: 300 })).toContain(
    "We sent ₱300.00 back",
  );
  expect(text("bill_settled", { amount: 710 })).toContain(
    "We received ₱710.00 at the front desk",
  );
  for (const e of [
    "paid",
    "partially_refunded",
    "room_charge",
    "bill_settled",
  ] as const)
    expect(text(e)).not.toContain("change or cancel");
});
