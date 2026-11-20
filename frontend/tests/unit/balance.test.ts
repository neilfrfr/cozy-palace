import { expect, it } from "vitest";
import { paidAndBalance } from "@/lib/reservations/normalize";
import type { Reservation } from "@/lib/reservations/types";
const booking = (payments: Reservation["payments"]) =>
  ({ total: 4300.5, payments }) as Reservation;
it("counts only accepted payments toward the balance, to the centavo", () => {
  expect(paidAndBalance(booking([]))).toEqual({ paid: 0, balance: 4300.5 });
  expect(
    paidAndBalance(
      booking([
        { status: "paid", amount_paid: 1000.1 },
        { status: "paid", amount_paid: 0.2 },
        { status: "review", amount_paid: 3300.2 },
        { status: "refunded", amount_paid: 4300.5 },
        { status: "open", amount_paid: null },
      ]),
    ),
  ).toEqual({ paid: 1000.3, balance: 3300.2 });
  expect(
    paidAndBalance(booking([{ status: "paid", amount_paid: 5000 }])).balance,
  ).toBe(0);
});
