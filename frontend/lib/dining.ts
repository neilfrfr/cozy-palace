import { z } from "zod";
import { guestFields } from "@/lib/operations/schema";
import { errorMessages } from "@/lib/reservations/errors";

const halfHours = (from: number, to: number) =>
  Array.from({ length: (to - from) * 2 + 1 }, (_, i) => {
    const minutes = from * 60 + i * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
  });
/** Bookable start times (Manila). Keep in step with private.dining_slot. */
export const diningSlots = [...halfHours(11, 14), ...halfHours(17, 21)];
export const SEATING_MS = 2 * 60 * 60 * 1000;
/** Furthest ahead a table can be booked; the database enforces the same. */
export const BOOKING_WINDOW_DAYS = 180;
/** Manila has no daylight saving, so a fixed offset is exact. */
export const slotStart = (date: string, time: string) =>
  `${date}T${time}:00+08:00`;

const booking = {
  tableId: z.uuid(),
  date: z.iso.date(),
  time: z.enum(diningSlots),
  guests: z.number().int().min(1).max(20),
  idempotencyKey: z.uuid(),
};
export const tableBookingSchema = z.object(booking).strict();
export const walkInSchema = z.object({ ...booking, ...guestFields }).strict();
export const tableStatuses = [
  "confirmed",
  "seated",
  "completed",
  "cancelled",
] as const;

export type TableBooking = {
  id: string;
  reference: string;
  status: string;
  guests: number;
  version: number;
  booking_source: "customer_online" | "staff_guest";
  guest_full_name: string | null;
  guest_phone: string | null;
  customer?: { full_name: string } | null;
  table_bookings: {
    start_at: string;
    end_at: string;
    restaurant_tables: { table_number: string };
  };
};

const manila = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});
const manilaTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  timeStyle: "short",
});
/** "Nov 4, 2026, 7:00 PM – 9:00 PM" */
export const seatingLabel = (b: TableBooking["table_bookings"]) =>
  `${manila.format(new Date(b.start_at))} – ${manilaTime.format(new Date(b.end_at))}`;

const diningErrors: Record<string, string> = {
  CAPACITY_EXCEEDED: "Choose a table with enough seats for your party.",
  RESOURCE_UNAVAILABLE: "This table isn't taking bookings right now.",
  AVAILABILITY_CONFLICT:
    "Someone has just booked this table for that time. Choose another table or time.",
  INVALID_INPUT: "Check the date, time, party size and guest details.",
  POLICY_RESTRICTED:
    "This booking can't be changed now. Seating and completing are for the booking's own day.",
  NOT_FOUND: "This table booking could not be found.",
};
export const diningError = (code: string) =>
  diningErrors[code] ?? errorMessages[code] ?? errorMessages.REQUEST_FAILED;
