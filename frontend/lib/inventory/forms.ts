import { z } from "zod";
const day = z.iso.date();
const capacityValue = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(20));
const rateValue = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform(Number)
  .pipe(z.number().min(0).max(1000000));
export const newRoomTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500),
    capacity: capacityValue,
    rate: rateValue,
  })
  .strict();
export const newRoomSchema = z
  .object({
    number: z.string().trim().min(1).max(30),
    typeId: z.uuid(),
  })
  .strict();
export const newTableSchema = z
  .object({
    number: z.string().trim().min(1).max(30),
    capacity: capacityValue,
  })
  .strict();
export const roomTypeSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500),
    rate: z.coerce.number().min(0).max(1000000),
    capacity: z.coerce.number().int().min(1).max(20),
  })
  .strict();
export const roomSchema = z
  .object({
    id: z.uuid(),
    number: z.string().trim().min(1).max(30),
    typeId: z.uuid(),
  })
  .strict();
export const tableSchema = z
  .object({
    id: z.uuid(),
    number: z.string().trim().min(1).max(30),
    capacity: z.coerce.number().int().min(1).max(20),
  })
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
  DUPLICATE_INVENTORY:
    "That room or table number is already in use. Choose a different number.",
  ROOM_IN_USE:
    "This room has booking or room charge history and cannot be deleted.",
  ROOM_TYPE_CHANGE_BLOCKED:
    "This room has booking history, so its room type cannot be changed.",
  ROOM_TYPE_IN_USE:
    "This room type still has rooms. Remove or move those rooms first.",
  roomDeleted: "Room deleted.",
  tableDeleted: "Table deleted.",
  extraDeleted: "Deleted.",
  TABLE_IN_USE:
    "This table has booking history and cannot be deleted. Close its dates instead.",
  EXTRA_IN_USE:
    "Bookings already include this item, so it cannot be deleted. Untick Active to stop offering it.",
  roomTypeDeleted: "Room type deleted.",
  roomTypeCreated: "Room type added.",
  roomTypeCreatedNoPhoto:
    "Room type added, but its photo didn't upload. Add it from Website → Photos.",
  INVALID_PHOTO: "Choose a JPEG, PNG or WebP image under 5 MB.",
  roomCreated: "Room added.",
  tableCreated: "Table added.",
  REQUEST_FAILED: "We could not save your changes. Please try again.",
};
