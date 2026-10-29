import { createHmac } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
const secret = "whsk_test_secret";
const paymentId = "20000000-0000-4000-8000-000000000001";
const event = (type = "checkout_session.payment.paid", amount = 1234567) =>
  JSON.stringify({
    data: {
      id: "evt_1",
      type: "event",
      attributes: {
        type,
        livemode: false,
        data: {
          id: "cs_1",
          type: "checkout_session",
          attributes: {
            reference_number: paymentId,
            payments: [
              { id: "pay_1", attributes: { amount, currency: "PHP", status: "paid" } },
            ],
          },
        },
      },
    },
  });
const sign = (body: string, key = secret, t = "1761700000") =>
  `t=${t},te=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")},li=`;
const post = async (body: string, signature: string | null) => {
  const { POST } = await import("@/app/api/paymongo/webhook/route");
  return POST(
    new Request("http://localhost/api/paymongo/webhook", {
      method: "POST",
      body,
      headers: signature ? { "paymongo-signature": signature } : {},
    }),
  );
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_key");
  vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", secret);
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  vi.stubEnv("VERCEL_ENV", "preview");
  mocks.rpc.mockResolvedValue({ data: "paid", error: null });
});
it("verifies the test-mode signature over the raw body", async () => {
  const { verifySignature } = await import("@/lib/payments/paymongo");
  const body = event();
  expect(verifySignature(sign(body), body, secret, false)).toBe(true);
  expect(verifySignature(sign(body), body.replace("1234567", "100"), secret, false)).toBe(false);
  expect(verifySignature(sign(body, "wrong"), body, secret, false)).toBe(false);
  expect(verifySignature(sign(body), body, secret, true)).toBe(false);
  expect(verifySignature(null, body, secret, false)).toBe(false);
  expect(verifySignature("t=1,te=abc", body, secret, false)).toBe(false);
});
it("reads the paid checkout and converts centavos to pesos", async () => {
  const { readPaidCheckout, centavos } = await import("@/lib/payments/paymongo");
  expect(readPaidCheckout(event())).toEqual({
    paymentId,
    providerPaymentId: "pay_1",
    amount: 12345.67,
    currency: "PHP",
  });
  expect(readPaidCheckout(event("payment.failed"))).toBeNull();
  expect(readPaidCheckout(event("checkout_session.payment.paid", -5))).toBe("INVALID");
  expect(readPaidCheckout("not json")).toBe("INVALID");
  expect(centavos(12345.67)).toBe(1234567);
  expect(centavos(0.1 + 0.2)).toBe(30);
});
it("never uses a live key outside Production, or without every secret", async () => {
  const { paymongoKey } = await import("@/lib/payments/paymongo");
  const env = { PAYMONGO_SECRET_KEY: "sk_live_x", PAYMONGO_WEBHOOK_SECRET: "w", SUPABASE_SECRET_KEY: "s" };
  expect(paymongoKey({ ...env, VERCEL_ENV: "preview" })).toBeNull();
  expect(paymongoKey(env)).toBeNull();
  expect(paymongoKey({ ...env, VERCEL_ENV: "production" })).toBe("sk_live_x");
  expect(paymongoKey({ ...env, PAYMONGO_SECRET_KEY: "sk_test_x" })).toBe("sk_test_x");
  expect(paymongoKey({ ...env, PAYMONGO_SECRET_KEY: "pk_test_x" })).toBeNull();
  expect(paymongoKey({ ...env, SUPABASE_SECRET_KEY: "" })).toBeNull();
});
it("webhook records a signed paid checkout with the amount PayMongo charged", async () => {
  const body = event();
  expect((await post(body, sign(body))).status).toBe(204);
  expect(mocks.rpc).toHaveBeenCalledWith("record_payment", {
    p_payment_id: paymentId,
    p_provider_payment_id: "pay_1",
    p_amount: 12345.67,
    p_currency: "PHP",
  });
});
it("webhook rejects unsigned, forged and live-signed events without touching the database", async () => {
  const body = event();
  expect((await post(body, null)).status).toBe(401);
  expect((await post(body, sign(body, "forged"))).status).toBe(401);
  expect((await post(body, sign(body).replace("te=", "li="))).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("webhook ignores other events, asks for a retry on database errors, and stays off when unconfigured", async () => {
  const other = event("payment.failed");
  expect((await post(other, sign(other))).status).toBe(204);
  expect(mocks.rpc).not.toHaveBeenCalled();
  const body = event();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "NOT_FOUND" } });
  expect((await post(body, sign(body))).status).toBe(204);
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "timeout" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await post(body, sign(body))).status).toBe(500);
  vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", "");
  expect((await post(body, sign(body))).status).toBe(503);
});
