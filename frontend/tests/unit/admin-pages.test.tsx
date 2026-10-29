import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const gate = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/authorize", () => ({ requireStaff: gate }));
vi.mock("@/lib/operations/service", () => ({
  getManagementDashboard: async () => ({
    counts: [
      { name: "rooms", count: 17 },
      { name: "reservations", count: 23 },
    ],
    pendingStaff: 2,
    pendingTables: 3,
    statuses: [{ status: "confirmed", count: 7 }],
    recent: [],
  }),
}));
it("admin summary uses actual queried counts without invented financial metrics", async () => {
  const { default: Page } = await import("@/app/admin/page");
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("17");
  expect(html).toContain("23");
  expect(html).toContain("<strong>3</strong> pending table requests");
  expect(html).not.toMatch(/revenue|78%|184,500/i);
});
it("admin layout requires administrator authority before returning its content", async () => {
  const { default: Layout } = await import("@/app/admin/layout");
  gate.mockRejectedValue(new Error("FORBIDDEN"));
  await expect(Layout({ children: "private" })).rejects.toThrow("FORBIDDEN");
  expect(gate).toHaveBeenCalledWith(true);
});
