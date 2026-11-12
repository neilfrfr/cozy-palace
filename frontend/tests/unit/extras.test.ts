import { expect, it } from "vitest";
import {
  extrasFromForm,
  extrasInput,
  extrasSummary,
  extrasTotal,
  lineTotal,
  priceExtras,
  type Extra,
} from "@/lib/extras";
import { reservationSchema } from "@/lib/reservations/schema";

const mattress: Extra = {
  id: "e0000000-0000-4000-8000-000000000001",
  name: "Extra mattress",
  description: "",
  kind: "extra",
  price: 800,
  pricing: "per_night",
  max_quantity: 2,
  active: true,
};
const kit: Extra = {
  ...mattress,
  id: "e0000000-0000-4000-8000-000000000002",
  name: "Amenity kit",
  price: 250,
  pricing: "per_stay",
  max_quantity: 4,
};

it("charges per-night extras for every night and per-stay extras once", () => {
  expect(
    lineTotal({ unit_price: 800, pricing: "per_night", quantity: 2 }, 3),
  ).toBe(4800);
  expect(
    lineTotal({ unit_price: 250, pricing: "per_stay", quantity: 2 }, 3),
  ).toBe(500);
  expect(
    extrasTotal(
      [
        { unit_price: 800, pricing: "per_night", quantity: 1 },
        { unit_price: 250, pricing: "per_stay", quantity: 3 },
      ],
      2,
    ),
  ).toBe(2350);
  expect(extrasTotal([], 5)).toBe(0);
});

it("prices chosen extras from the item list, never from the browser", () => {
  const lines = priceExtras(
    [
      { id: mattress.id, quantity: 2 },
      { id: kit.id, quantity: 1 },
    ],
    [mattress, kit],
    3,
  );
  expect(lines).toEqual([
    {
      name: "Extra mattress",
      unit_price: 800,
      pricing: "per_night",
      quantity: 2,
      line_total: 4800,
    },
    {
      name: "Amenity kit",
      unit_price: 250,
      pricing: "per_stay",
      quantity: 1,
      line_total: 250,
    },
  ]);
  expect(extrasSummary(lines!)).toBe(
    "Extra mattress × 2 (₱4,800) · Amenity kit × 1 (₱250)",
  );
  expect(extrasSummary([])).toBe("None");
});

it("rejects quantities over the maximum, inactive and unknown items", () => {
  expect(
    priceExtras([{ id: mattress.id, quantity: 3 }], [mattress], 1),
  ).toBeNull();
  expect(
    priceExtras([{ id: kit.id, quantity: 1 }], [{ ...kit, active: false }], 1),
  ).toBeNull();
  expect(priceExtras([{ id: kit.id, quantity: 1 }], [mattress], 1)).toBeNull();
});

it("accepts only ids and whole quantities from the form, skipping zeros", () => {
  const form = new FormData();
  form.set("extra:" + mattress.id, "1");
  form.set("extra:" + kit.id, "0");
  form.set("guests", "2");
  expect(extrasFromForm(form)).toEqual([{ id: mattress.id, quantity: 1 }]);
  expect(
    extrasInput.safeParse([{ id: kit.id, quantity: 1, price: 0 }]).success,
  ).toBe(false);
  expect(extrasInput.safeParse([{ id: kit.id, quantity: 0 }]).success).toBe(
    false,
  );
  expect(extrasInput.safeParse([{ id: kit.id, quantity: 1.5 }]).success).toBe(
    false,
  );
  expect(
    extrasInput.safeParse([
      { id: kit.id, quantity: 1 },
      { id: kit.id, quantity: 2 },
    ]).success,
  ).toBe(false);
  const booking = {
    roomId: "10000000-0000-4000-8000-000000000001",
    checkIn: "2030-01-01",
    checkOut: "2030-01-03",
    guests: 2,
    idempotencyKey: "a0000000-0000-4000-8000-000000000001",
  };
  expect(reservationSchema.parse(booking).extras).toEqual([]);
});
