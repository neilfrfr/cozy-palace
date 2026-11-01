import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminConfigured: () => true,
  createAdminClient: () => ({ rpc }),
}));
import { findReservationAction } from "@/app/actions/find-reservation";
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const full = { first: "Juan", last: "Dela Cruz", reference: "CP-ABC123" };
beforeEach(() => rpc.mockReset());
it("passes all three fields and the visitor's IP to the server-only lookup", async () => {
  rpc.mockResolvedValueOnce({ data: { reference: "CP-ABC123" }, error: null });
  expect(await findReservationAction({}, form(full))).toEqual({
    found: { reference: "CP-ABC123" },
  });
  expect(rpc).toHaveBeenCalledWith("find_guest_booking", {
    p_first_name: "Juan",
    p_last_name: "Dela Cruz",
    p_reference: "CP-ABC123",
    p_client_ip: "203.0.113.9",
  });
});
it("gives one message for any miss, and says when the limit is hit", async () => {
  expect(
    (await findReservationAction({}, form({ ...full, last: "" }))).message,
  ).toMatch(/Enter your first name/);
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({ data: null, error: null });
  const miss = (await findReservationAction({}, form(full))).message;
  rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "INVALID_INPUT" },
  });
  expect((await findReservationAction({}, form(full))).message).toBe(miss);
  rpc.mockResolvedValueOnce({ data: null, error: { message: "RATE_LIMITED" } });
  expect((await findReservationAction({}, form(full))).message).toMatch(
    /Too many lookups/,
  );
});
