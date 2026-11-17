import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/authorize", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
import {
  parseRefundAmount,
  remainingRefundable,
  type LedgerPayment,
} from "@/lib/payments/ledger";
import { createRefund, readRefund } from "@/lib/payments/xendit";
import { POST } from "@/app/api/xendit/webhook/route";

const token = "xnd_webhook_token";
const refundId = "40000000-0000-4000-8000-000000000001";
const callback = (
  event = "refund.succeeded",
  reference_id: string = refundId,
) =>
  JSON.stringify({
    event,
    business_id: "b1",
    created: "2026-11-12T01:00:00Z",
    data: {
      id: "rfd-1",
      invoice_id: "inv_1",
      reference_id,
      amount: 500,
      currency: "PHP",
      status: event === "refund.succeeded" ? "SUCCEEDED" : "FAILED",
      failure_code: event === "refund.failed" ? "INSUFFICIENT_BALANCE" : null,
    },
  });
const post = (body: string, header: string | null = token) =>
  POST(
    new Request("http://localhost/api/xendit/webhook", {
      method: "POST",
      body,
      headers: header ? { "x-callback-token": header } : {},
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("XENDIT_SECRET_KEY", "xnd_development_key");
  vi.stubEnv("XENDIT_WEBHOOK_TOKEN", token);
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  vi.stubEnv("VERCEL_ENV", "preview");
  mocks.rpc.mockResolvedValue({ data: "succeeded", error: null });
});

it("accepts refund amounts in pesos with up to two decimals, within what is left", () => {
  expect(parseRefundAmount("1500")).toBe(1500);
  expect(parseRefundAmount(" 0.29 ", 0.29)).toBe(0.29);
  expect(parseRefundAmount("1500.5", 1500.5)).toBe(1500.5);
  expect(parseRefundAmount("1500.51", 1500.5)).toBeNull();
  expect(parseRefundAmount("0")).toBeNull();
  expect(parseRefundAmount("-5")).toBeNull();
  expect(parseRefundAmount("1.234")).toBeNull();
  expect(parseRefundAmount("1e3")).toBeNull();
  expect(parseRefundAmount("")).toBeNull();
  expect(parseRefundAmount(null)).toBeNull();
});

it("counts only confirmed refunds against what is left to refund", () => {
  const p = {
    amount_paid: 1000.3,
    refunds: [
      { amount: 0.1, status: "succeeded" },
      { amount: 0.2, status: "succeeded" },
      { amount: 500, status: "failed" },
      { amount: 100, status: "pending" },
    ],
  } as LedgerPayment;
  expect(remainingRefundable(p)).toBe(1000);
  expect(remainingRefundable({ ...p, refunds: [] })).toBe(1000.3);
});

it("reads our refund callbacks and ignores everything else", () => {
  expect(readRefund(callback())).toEqual({
    refundId,
    status: "succeeded",
    providerRefundId: "rfd-1",
    failureCode: null,
  });
  expect(readRefund(callback("refund.failed"))).toMatchObject({
    status: "failed",
    failureCode: "INSUFFICIENT_BALANCE",
  });
  // A dashboard refund has no reference of ours; invoices have no refund event.
  expect(readRefund(callback("refund.succeeded", "dashboard-1"))).toBeNull();
  expect(readRefund(JSON.stringify({ status: "PAID" }))).toBeNull();
  expect(readRefund("not json")).toBe("INVALID");
});

it("webhook settles a refund by its id, and replays are left to the database", async () => {
  expect((await post(callback())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("settle_refund", {
    p_refund_id: refundId,
    p_status: "succeeded",
    p_provider_refund_id: "rfd-1",
    p_failure_code: null,
  });
  expect((await post(callback(), "forged")).status).toBe(401);
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "NOT_FOUND" },
  });
  expect((await post(callback())).status).toBe(200);
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "timeout" },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await post(callback())).status).toBe(500);
});

it("asks Xendit for the refund with the refund id as idempotency key", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "rfd-1", status: "PENDING" })),
    );
  vi.stubGlobal("fetch", fetchMock);
  const args = {
    refundId,
    invoiceId: "inv_1",
    amount: 500.5,
    reason: "CANCELLATION",
  };
  await expect(createRefund("xnd_development_key", args)).resolves.toEqual({
    status: "PENDING",
  });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.xendit.co/refunds");
  expect(init.headers["idempotency-key"]).toBe(refundId);
  expect(JSON.parse(init.body)).toEqual({
    invoice_id: "inv_1",
    reference_id: refundId,
    amount: 500.5,
    currency: "PHP",
    reason: "CANCELLATION",
  });
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ error_code: "REFUND_NOT_SUPPORTED" }), {
      status: 400,
    }),
  );
  await expect(createRefund("xnd_development_key", args)).resolves.toEqual({
    status: "FAILED",
    code: "REFUND_NOT_SUPPORTED",
  });
  fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
  await expect(createRefund("xnd_development_key", args)).rejects.toThrow(
    "XENDIT_503",
  );
  vi.unstubAllGlobals();
});
