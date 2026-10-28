import { z } from "zod";
import { isValidPhone } from "@/lib/phone";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  }, "Enter a valid date.");
const fields = {
  roomId: z.uuid(),
  checkIn: date,
  checkOut: date,
  guests: z.number().int().min(1).max(20),
};
const dates = (v: { checkIn: string; checkOut: string }) =>
  v.checkOut > v.checkIn &&
  (Date.parse(v.checkOut) - Date.parse(v.checkIn)) / 86400000 <= 365;
export const reservationSchema = z
  .object({ ...fields, idempotencyKey: z.uuid() })
  .strict()
  .refine(dates, {
    path: ["checkOut"],
    message: "Check-out must be after check-in and within 365 nights.",
  });
export const updateSchema = z
  .object({ ...fields, id: z.uuid(), version: z.number().int().positive() })
  .strict()
  .refine(dates, { path: ["checkOut"], message: "Check the stay dates." });
export const guestOnlineSchema = z
  .object({
    ...fields,
    guestFullName: z.string().trim().min(2).max(100),
    guestEmail: z.email().trim().max(254),
    guestPhone: z.string().trim().refine(isValidPhone),
    idempotencyKey: z.uuid(),
  })
  .strict()
  .refine(dates, {
    path: ["checkOut"],
    message: "Check-out must be after check-in and within 365 nights.",
  });
export type ReservationInput = z.infer<typeof reservationSchema>;
export function parseReservationInput(value: unknown): ReservationInput {
  return reservationSchema.parse(value);
}
export const mutationSchema = z
  .object({ id: z.uuid(), version: z.number().int().positive() })
  .strict();
