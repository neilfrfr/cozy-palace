import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  getReservation: vi.fn(),
  getRoom: vi.fn(),
  requireIdentity: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/reservations/service", () => ({
  getReservation: mocks.getReservation,
}));
vi.mock("@/lib/inventory/service", () => ({ getRoom: mocks.getRoom }));
vi.mock("@/lib/auth/authorize", () => ({
  requireIdentity: mocks.requireIdentity,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
const reservation = {
  id: "20000000-0000-4000-8000-000000000001",
  reference: "CP-LIVE-REFERENCE",
  customer_id: "30000000-0000-4000-8000-000000000001",
  status: "pending" as const,
  guests: 3,
  total: 12345.67,
  currency: "PHP",
  version: 2,
  created_at: "2026-10-18T00:00:00Z",
  room_bookings: [
    {
      room_id: "10000000-0000-4000-8000-000000000001",
      check_in: "2026-11-01",
      check_out: "2026-11-03",
      rate_at_booking: 6172.835,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireIdentity.mockResolvedValue({});
  mocks.getReservation.mockResolvedValue(reservation);
  mocks.getRoom.mockResolvedValue(null);
});
it("checkout presents actual booking data and never offers a working payment or invented wallet", async () => {
  const { CheckoutSummary } = await import("@/components/checkout-summary");
  for (const status of [
    "draft",
    "pending",
    "confirmed",
    "cancelled",
    "expired",
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(CheckoutSummary, {
        reservation: { ...reservation, status },
        room: null,
      }),
    );
    expect(html).toContain("CP-LIVE-REFERENCE");
    expect(html).toContain("12,345.67");
    expect(html).toContain(status);
    expect(html).toContain("E-wallet payments are not available yet.");
    expect(html).toContain("disabled");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("+63");
    expect(html).not.toContain("Pay &amp; Confirm");
  }
});
it("checkout refuses invalid IDs and missing or foreign owned-query results", async () => {
  const { default: Page } =
    await import("@/app/reservations/[id]/checkout/page");
  await expect(
    Page({ params: Promise.resolve({ id: "invalid" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.getReservation).not.toHaveBeenCalled();
  mocks.getReservation.mockResolvedValue(null);
  await expect(
    Page({ params: Promise.resolve({ id: reservation.id }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.getRoom).not.toHaveBeenCalled();
});
it("checkout requires identity with a safe return destination", async () => {
  const { default: Page } =
    await import("@/app/reservations/[id]/checkout/page");
  await Page({ params: Promise.resolve({ id: reservation.id }) });
  expect(mocks.requireIdentity).toHaveBeenCalledWith(
    `/reservations/${reservation.id}/checkout`,
  );
});
