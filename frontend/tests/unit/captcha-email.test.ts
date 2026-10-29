import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ adminConfigured: () => true }));
const fetchMock = vi.fn();
beforeEach(() => {
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
it("emails the booking details with the guest's name escaped, and skips when not configured", async () => {
  const { sendBookingEmail } = await import("@/lib/email");
  const booking = {
    to: "walk@example.test",
    name: "<script>x</script>",
    reference: "CP-ABC",
    booking: "a stay from 2027-01-10 to 2027-01-12",
    guests: 2,
    next: "We hold the room for 24 hours.",
    id: "20000000-0000-4000-8000-000000000001",
  };
  expect(await sendBookingEmail(booking)).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "Cozy Palace <onboarding@resend.dev>");
  fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
  expect(await sendBookingEmail(booking)).toBe(true);
  const [, init] = fetchMock.mock.calls[0];
  const sent = JSON.parse(init.body as string);
  expect(sent.to).toEqual(["walk@example.test"]);
  expect(sent.html).toContain("&lt;script&gt;");
  expect(sent.html).not.toContain("<script>");
  expect(sent.text).toContain(
    "CP-ABC: a stay from 2027-01-10 to 2027-01-12, 2 guests",
  );
  expect(sent.text).not.toContain("http");
  expect(init.headers["idempotency-key"]).toBe("booking-" + booking.id);
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockResolvedValueOnce(new Response("{}", { status: 422 }));
  expect(await sendBookingEmail(booking)).toBe(false);
});
