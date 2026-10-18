import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const gate = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/authorize", () => ({ requireStaff: gate }));
vi.mock("@/lib/inventory/service", () => ({
  getAdminCounts: async () => [
    { name: "rooms", count: 17 },
    { name: "restaurant_tables", count: 9 },
    { name: "staff_members", count: 4 },
    { name: "reservations", count: 23 },
  ],
}));
it("admin summary uses actual queried counts without invented financial metrics", async () => {
  const { default: Page } = await import("@/app/admin/page");
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("17");
  expect(html).toContain("23");
  expect(html).not.toMatch(/revenue|78%|184,500/i);
});
it("admin layout requires administrator authority before returning its content", async () => {
  const { default: Layout } = await import("@/app/admin/layout");
  gate.mockRejectedValue(new Error("FORBIDDEN"));
  await expect(Layout({ children: "private" })).rejects.toThrow("FORBIDDEN");
  expect(gate).toHaveBeenCalledWith(true);
});
