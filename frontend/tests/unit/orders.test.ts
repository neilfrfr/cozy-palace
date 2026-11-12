import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { orderLines, orderSchema, roomBill } from "@/lib/orders";
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
it("totals the room bill, leaving out cancelled charges", () => {
  const charge = (
    total: number,
    status: "open" | "completed" | "cancelled",
    paid_at: string | null = null,
  ) => ({ total, status, paid_at });
  expect(
    roomBill(
      7400,
      [{ line_total: 1000 }],
      [
        charge(360, "open"),
        charge(450.5, "completed", "2027-01-11T10:00:00Z"),
        charge(999, "cancelled"),
      ],
    ),
  ).toEqual({
    room: 6400,
    extras: 1000,
    charges: 810.5,
    unpaid: 360,
    total: 8210.5,
  });
  expect(roomBill(3200, [], [])).toEqual({
    room: 3200,
    extras: 0,
    charges: 0,
    unpaid: 0,
    total: 3200,
  });
});
