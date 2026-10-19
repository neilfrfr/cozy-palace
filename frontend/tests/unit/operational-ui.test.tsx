import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/operations/service", () => ({
  getStaffDashboard: async () => ({
    date: "2026-10-19",
    metrics: [
      {
        name: "Today's arrivals",
        count: 7,
        href: "/staff/reservations?date=2026-10-19",
      },
    ],
  }),
}));
it("staff dashboard prioritizes guest operations without customer booking links", async () => {
  const { default: Page } = await import("@/app/staff/(operations)/page");
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("New guest booking");
  expect(html).toContain("7");
  expect(html).not.toContain("My reservations");
  expect(html).not.toContain("Plan a stay");
});
it("empty operational queue offers guest booking instead of a personal stay", async () => {
  const { OperationalReservationList } = await import(
    "@/components/operational-reservation-list"
  );
  const html = renderToStaticMarkup(<OperationalReservationList rows={[]} />);
  expect(html).toContain("New guest booking");
  expect(html).not.toContain("Explore rooms");
});
