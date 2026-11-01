import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { orderLines, orderSchema } from "@/lib/orders";
const id = "20000000-0000-4000-8000-000000000001";
it("reads quantities from the order form and ignores everything else", () => {
  const f = new FormData();
  f.set("qty:" + id, "2");
  f.set("qty:20000000-0000-4000-8000-000000000002", "0");
  f.set("qty:20000000-0000-4000-8000-000000000003", "");
  f.set("total", "1");
  expect(orderLines(f)).toEqual([{ item: id, quantity: 2 }]);
  const base = { reservation: "", note: "", key: id };
  expect(orderSchema.safeParse({ ...base, items: orderLines(f) }).success).toBe(
    true,
  );
  expect(orderSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  expect(
    orderSchema.safeParse({ ...base, items: [{ item: id, quantity: 1.5 }] })
      .success,
  ).toBe(false);
  expect(
    orderSchema.safeParse({
      ...base,
      items: [{ item: id, quantity: 2 }],
      total: 1,
    }).success,
  ).toBe(false);
});
