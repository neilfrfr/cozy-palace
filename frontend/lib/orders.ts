import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeReference } from "@/lib/format";

export type MenuSection = {
  id: string;
  name: string;
  description: string;
};
export type MenuRow = {
  id: string;
  name: string;
  description: string;
  section: string;
  price: number;
  available: boolean;
  archived: boolean;
  /** Archived rows only: order lines that use it, which block deleting it for good. */
  order_items?: { count: number }[];
};
export type Order = {
  id: string;
  reference: string;
  status: "open" | "completed" | "cancelled";
  total: number;
  note: string | null;
  version: number;
  created_at: string;
  paid_at: string | null;
  payment_method: (typeof paymentMethods)[number] | null;
  payment_reference: string | null;
  reservations: {
    reference: string;
    guest_full_name: string | null;
    customer: { full_name: string } | null;
  } | null;
  /** Set on a room charge: the order waits on the stay's room bill. */
  rooms: { room_number: string } | null;
  staff: { full_name: string } | null;
  order_items: { name: string; unit_price: number; quantity: number }[];
};

export const paymentMethods = [
  "cash",
  "gcash",
  "maya",
  "card",
  "bank_transfer",
] as const;

export const peso = (n: number) =>
  "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 });

/** Active items in the admin's chosen order; pass true for the archived ones instead. */
export async function getMenu(archived = false): Promise<MenuRow[]> {
  const db = await createClient();
  const { data } = await db
    .from("menu_items")
    .select(
      "id,name,description,section,price,available,archived" +
        (archived ? ",order_items(count)" : ""),
    )
    .eq("archived", archived)
    .order("position")
    .order("name");
  return (data ?? []) as unknown as MenuRow[];
}

export async function getMenuSections(): Promise<MenuSection[]> {
  const db = await createClient();
  const { data } = await db
    .from("menu_sections")
    .select("id,name,description")
    .order("position")
    .order("name");
  return (data ?? []) as MenuSection[];
}

const orderFields =
  "id,reference,status,total,note,version,created_at,paid_at,payment_method,payment_reference,reservations(reference,guest_full_name,customer:profiles!reservations_customer_id_fkey(full_name)),rooms(room_number),staff:profiles!orders_staff_id_fkey(full_name),order_items(name,unit_price,quantity)";

/** RLS limits customers to their own orders; staff see all unless a customer is given. */
export async function getOrders(
  customerId?: string,
  limit = 50,
): Promise<Order[]> {
  const db = await createClient();
  let query = db
    .from("orders")
    .select(orderFields)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (customerId) query = query.eq("customer_id", customerId);
  const { data } = await query;
  return (data ?? []) as unknown as Order[];
}

/** A stay's room charges, oldest first, for its room bill. */
export async function getRoomCharges(reservationId: string): Promise<Order[]> {
  const db = await createClient();
  const { data } = await db
    .from("orders")
    .select(orderFields)
    .eq("reservation_id", reservationId)
    .not("room_id", "is", null)
    .order("created_at");
  return (data ?? []) as unknown as Order[];
}

/** The room bill: the booking (room and extras, paid online) plus room charges; cancelled charges don't count. */
export function roomBill(
  bookingTotal: number,
  extras: { line_total: number }[],
  charges: Pick<Order, "total" | "status" | "paid_at">[],
) {
  const sum = (rows: { total: number }[]) =>
    rows.reduce((n, r) => n + Number(r.total), 0);
  const live = charges.filter((c) => c.status !== "cancelled");
  const extrasTotal = extras.reduce((n, e) => n + Number(e.line_total), 0);
  const chargesTotal = sum(live);
  return {
    room: Number(bookingTotal) - extrasTotal,
    extras: extrasTotal,
    charges: chargesTotal,
    unpaid: sum(live.filter((c) => !c.paid_at)),
    total: Number(bookingTotal) + chargesTotal,
  };
}

/** Form fields "qty:<menu item id>" become [{item, quantity}], skipping blanks and zeros. */
export function orderLines(form: FormData) {
  return [...form.entries()].flatMap(([k, v]) => {
    if (!k.startsWith("qty:")) return [];
    const quantity = Number(v || 0);
    return quantity ? [{ item: k.slice(4), quantity }] : [];
  });
}
export const orderSchema = z
  .object({
    items: z
      .array(
        z.object({
          item: z.uuid(),
          quantity: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(30),
    reservation: z.string().trim().max(20).transform(normalizeReference),
    room: z.string().trim().max(10).default(""),
    note: z.string().trim().max(200),
    key: z.uuid(),
  })
  .strict();
export const menuItemSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500),
    section: z.string().trim().min(1).max(40),
    price: z.coerce.number().min(0).max(100000),
    available: z.boolean(),
  })
  .strict();
export const menuSectionSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(1).max(40),
    description: z.string().trim().max(200),
  })
  .strict();

export const orderPaymentSchema = z
  .object({
    id: z.uuid(),
    version: z.coerce.number().int().positive(),
    method: z.enum(paymentMethods),
    reference: z.string().trim().max(100),
  })
  .strict();

export const roomBillSchema = z
  .object({
    id: z.uuid(),
    method: z.enum(paymentMethods),
    reference: z.string().trim().max(100),
  })
  .strict();

export const orderMessages: Record<string, string> = {
  created: "Order saved.",
  paid: "Payment recorded.",
  settled: "Room bill settled.",
  payment_recorded: "Payment recorded. The guest is emailed a receipt.",
  INVALID_PAYMENT:
    "Enter an amount above ₱0 with up to two decimals, pick a method, and keep the reference under 100 characters.",
  INVALID_AMOUNT:
    "That is more than the booking still owes. Check the amount and try again.",
  PAYMENT_CLOSED:
    "This booking can't take a payment now: it has ended, been cancelled, or its hold has lapsed.",
  saved: "Saved.",
  deleted: "Deleted.",
  archived: "Menu item archived. Restore it from the Archived tab.",
  unarchived: "Menu item restored to the menu.",
  DUPLICATE_NAME: "That name is already used on the menu. Pick another.",
  MENU_ITEM_IN_USE:
    "This item is on past orders, so it stays archived to keep order history.",
  SECTION_IN_USE:
    "Move or archive this section's items before deleting it.",
  LAST_SECTION: "The menu needs at least one section.",
  reordered: "Order saved.",
  MENU_CHANGED: "The menu changed in another window, so that move was not saved. Try again.",
  uploaded: "Menu photo updated.",
  restored: "Menu photo removed.",
  INVALID_PHOTO: "Choose a JPEG, PNG or WebP image under 5 MB.",
  REQUEST_FAILED: "The photo could not be saved. Try again.",
  FORBIDDEN: "You do not have access to this.",
  NOT_FOUND:
    "No reservation has that reference. Check it, or leave it blank for a walk-in.",
  VERSION_CONFLICT:
    "This order changed in the meantime. Check it and try again.",
  NO_CURRENT_STAY:
    "No guest is checked in to that room. Check the room number, or use a booking number instead.",
  INVALID_INPUT:
    "Pick at least one available item (1–50 each) and check the details. Use a booking number or a room number, not both.",
  INVALID_TRANSITION:
    "This can't be changed now. Paid orders can't be cancelled, an order is paid only once, and room charges are paid by settling the room bill.",
};
