import { expect, it } from "vitest";
import {
  addDays,
  bookedNights,
  fullyBookedNights,
  latestCheckOut,
} from "@/lib/reservations/availability";

const ranges = [
  { roomId: "a", checkIn: "2027-01-30", checkOut: "2027-02-02" },
  { roomId: "b", checkIn: "2027-02-01", checkOut: "2027-02-03" },
];

it("adds days across month ends", () => {
  expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
  expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
});

it("lists the nights a room is booked, not its check-out morning", () => {
  expect([...bookedNights(ranges, "a")]).toEqual([
    "2027-01-30",
    "2027-01-31",
    "2027-02-01",
  ]);
});

it("only treats a night as fully booked when every room is taken", () => {
  expect([...fullyBookedNights(ranges, ["a", "b"])]).toEqual(["2027-02-01"]);
  expect([...fullyBookedNights(ranges, [])]).toEqual([]);
});

it("ends a stay on the morning of the next booked night", () => {
  const nights = bookedNights(ranges, "b");
  expect(latestCheckOut("2027-01-28", nights)).toBe("2027-02-01");
  expect(latestCheckOut("2027-02-03", nights)).toBeUndefined();
});
