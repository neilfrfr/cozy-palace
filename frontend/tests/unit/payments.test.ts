import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
const token = "xnd_webhook_token";
const paymentId = "20000000-0000-4000-8000-000000000001";
const invoice = (status = "PAID", paid_amount: unknown = 12345.67) =>
  JSON.stringify({
    id: "inv_1",
    external_id: paymentId,
    status,
    amount: 12345.67,
    paid_amount,
    currency: "PHP",
    payment_channel: "GCASH",
  });
const post = async (body: string, header: string | null) => {
  const { POST } = await import("@/app/api/xendit/webhook/route");
  return POST(
    new Request("http://localhost/api/xendit/webhook", {
      method: "POST",
      body,
      headers: header ? { "x-callback-token": header } : {},
    }),
  );
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("XENDIT_SECRET_KEY", "xnd_development_key");
  vi.stubEnv("XENDIT_WEBHOOK_TOKEN", token);
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  vi.stubEnv("VERCEL_ENV", "preview");
  mocks.rpc.mockResolvedValue({ data: "paid", error: null });
});
it("accepts only the exact callback token", async () => {
  const { verifyToken } = await import("@/lib/payments/xendit");
  expect(verifyToken(token, token)).toBe(true);
  expect(verifyToken("wrong", token)).toBe(false);
  expect(verifyToken(token + "x", token)).toBe(false);
  expect(verifyToken(null, token)).toBe(false);
  expect(verifyToken("", "")).toBe(false);
});
it("reads a paid or settled invoice and ignores other statuses", async () => {
  const { readPaidInvoice } = await import("@/lib/payments/xendit");
  const paid = { paymentId, providerPaymentId: "inv_1", amount: 12345.67, currency: "PHP" };
  expect(readPaidInvoice(invoice())).toEqual(paid);
  expect(readPaidInvoice(invoice("SETTLED"))).toEqual(paid);
  expect(readPaidInvoice(invoice("EXPIRED"))).toBeNull();
  expect(readPaidInvoice(invoice("PAID", -5))).toBe("INVALID");
  expect(readPaidInvoice(invoice("PAID", "12345.67"))).toBe("INVALID");
  expect(readPaidInvoice("not json")).toBe("INVALID");
});
it("never uses a production key outside Production, or without every secret", async () => {
  const { xenditKey } = await import("@/lib/payments/xendit");
  const env = { XENDIT_SECRET_KEY: "xnd_production_x", XENDIT_WEBHOOK_TOKEN: "w", SUPABASE_SECRET_KEY: "s" };
  expect(xenditKey({ ...env, VERCEL_ENV: "preview" })).toBeNull();
  expect(xenditKey(env)).toBeNull();
  expect(xenditKey({ ...env, VERCEL_ENV: "production" })).toBe("xnd_production_x");
  expect(xenditKey({ ...env, XENDIT_SECRET_KEY: "xnd_development_x" })).toBe("xnd_development_x");
  expect(xenditKey({ ...env, XENDIT_SECRET_KEY: "xnd_public_development_x" })).toBeNull();
  expect(xenditKey({ ...env, SUPABASE_SECRET_KEY: "" })).toBeNull();
});
it("webhook records a paid invoice with the amount Xendit collected", async () => {
  expect((await post(invoice(), token)).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("record_payment", {
    p_payment_id: paymentId,
    p_provider_payment_id: "inv_1",
    p_amount: 12345.67,
    p_currency: "PHP",
  });
});
it("webhook rejects missing or wrong tokens without touching the database", async () => {
  expect((await post(invoice(), null)).status).toBe(401);
  expect((await post(invoice(), "forged")).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("webhook ignores other statuses, asks for a retry on database errors, and stays off when unconfigured", async () => {
  expect((await post(invoice("EXPIRED"), token)).status).toBe(200);
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "NOT_FOUND" } });
  expect((await post(invoice(), token)).status).toBe(200);
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "timeout" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await post(invoice(), token)).status).toBe(500);
  vi.stubEnv("XENDIT_WEBHOOK_TOKEN", "");
  expect((await post(invoice(), token)).status).toBe(503);
});
