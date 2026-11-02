import { z } from "zod";
const day = z.iso.date();
export const roomTypeSchema = z
  .object({
    id: z.uuid(),
    rate: z.coerce.number().min(0).max(1000000),
    capacity: z.coerce.number().int().min(1).max(20),
  })
  .strict();
export const tableSchema = z
  .object({ id: z.uuid(), capacity: z.coerce.number().int().min(1).max(20) })
  .strict();
export const closureSchema = z
  .object({
    resource: z.uuid(),
    from: day,
    to: day,
    reason: z.string().trim().min(1).max(200),
  })
  .strict()
  .refine((c) => c.to > c.from);
export const inventoryMessages: Record<string, string> = {
  saved: "Saved. New bookings use these values; existing bookings keep theirs.",
  closed: "Closed for those dates.",
  reopened: "Reopened.",
  FORBIDDEN: "Only administrators can change inventory.",
  NOT_FOUND: "That item no longer exists. Refresh the page.",
  INVALID_INPUT:
    "Check the values: capacity 1–20, and a closure must end after it starts and not be in the past.",
  RESOURCE_HAS_BOOKINGS:
    "Bookings already use those dates. Move or cancel them first, then close the dates.",
  REQUEST_FAILED: "We could not save your changes. Please try again.",
};
