import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const gate = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/authorize", () => ({ requireStaff: gate }));
vi.mock("@/lib/operations/service", () => ({
  getManagementDashboard: async () => ({
    counts: [
      { name: "rooms", count: 17 },
      { name: "staff_members", count: 23 },
    ],
    pendingStaff: 2,
    pendingTables: 3,
    statuses: [{ status: "confirmed", count: 7 }],
    recent: [],
  }),
  getOverviewInsights: async () => ({
    today: "2026-11-25",
    totalRooms: 17,
    moves: { checkIns: 4, arrived: 1, checkOuts: 2, left: 2 },
    rooms: { occupied: 9, reserved: 3, available: 4, closed: 1 },
    money: {
      months: [
        { month: "2026-10", amount: 50000 },
        { month: "2026-11", amount: 61234 },
      ],
      soFar: 61234,
      change: 0.25,
    },
    bookings: [{ date: "2026-11-25", rooms: 2, tables: 5 }],
  }),
}));
it("admin summary shows only the queried counts and money", async () => {
  const { default: Page } = await import("@/app/admin/page");
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("17");
  expect(html).toContain("23");
  expect(html).toContain('<strong class="key-tag">3</strong><span class="pigeonhole-name">Table requests');
  expect(html).toContain("₱61,234");
  expect(html).toContain("Up 25% on the same days of October");
  expect(html).toContain("12 <small>of 17</small>");
  expect(html).toContain("1 already arrived");
  expect(html).not.toMatch(/184,500|78%/);
});
it("admin layout requires administrator authority before returning its content", async () => {
  const { default: Layout } = await import("@/app/admin/layout");
  gate.mockRejectedValue(new Error("FORBIDDEN"));
  await expect(Layout({ children: "private" })).rejects.toThrow("FORBIDDEN");
  expect(gate).toHaveBeenCalledWith(true);
});
