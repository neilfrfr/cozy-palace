import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ isConfigured: () => true }));
vi.mock("@/lib/reservations/service", () => ({
  getRooms: async () => [
    {
      id: "10000000-0000-4000-8000-000000000001",
      room_number: "909",
      room_types: {
        id: "00000000-0000-4000-8000-000000000001",
        code: "RT-999",
        name: "Live renamed room",
        description: "Database description",
        capacity: 5,
        nightly_rate: 8765,
      },
    },
  ],
}));
import Home from "@/app/page";
it("home uses Figma composition and database room content rather than design fixtures", async () => {
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain("Stay a little.");
  expect(html).toContain("Savour a lot.");
  expect(html).toContain("Live renamed room");
  expect(html).toContain("8,765");
  expect(html).not.toContain("Deluxe King Room");
  expect(html).not.toContain("4,500");
  expect(html).toContain("hotel-hero.jpg");
});
