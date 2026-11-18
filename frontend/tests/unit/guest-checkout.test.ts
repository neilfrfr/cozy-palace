import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminConfigured: () => true,
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
import { startGuestCheckoutAction } from "@/app/actions/payments";
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("XENDIT_SECRET_KEY", "xnd_development_key");
  vi.stubEnv("XENDIT_WEBHOOK_TOKEN", "token");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
});
it("checks the name and booking number server-side, then reuses the live invoice", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: {
      id: "p1",
      amount: 5000,
      reference: "42",
      checkout_url: "https://checkout.xendit.co/inv_1",
    },
    error: null,
  });
  await expect(
    startGuestCheckoutAction(
      null,
      form({ first: "Juan", last: "Dela Cruz", reference: "#0042" }),
    ),
  ).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.rpc).toHaveBeenCalledWith("open_guest_payment", {
    p_first_name: "Juan",
    p_last_name: "Dela Cruz",
    p_reference: "42",
    p_client_ip: "203.0.113.9",
  });
  expect(mocks.redirect).toHaveBeenCalledWith(
    "https://checkout.xendit.co/inv_1",
  );
});
it("rejects missing fields and reports a mismatch without opening an invoice", async () => {
  expect(
    await startGuestCheckoutAction(
      null,
      form({ first: "Juan", reference: "42" }),
    ),
  ).toEqual({ code: "INVALID_INPUT" });
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "NOT_FOUND" },
  });
  expect(
    await startGuestCheckoutAction(
      null,
      form({ first: "Juan", last: "Cruz", reference: "42" }),
    ),
  ).toEqual({ code: "NOT_FOUND" });
  expect(mocks.redirect).not.toHaveBeenCalled();
});
