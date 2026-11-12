import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeReference } from "@/lib/format";

export const menuSections = [
  "Appetizers",
  "Main Course",
  "Dessert",
  "Drinks",
] as const;
export type MenuRow = {
  id: string;
  name: string;
  section: (typeof menuSections)[number];
  price: number;
  available: boolean;
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
  reservations: { reference: string } | null;
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

export async function getMenu(): Promise<MenuRow[]> {
  const db = await createClient();
  const { data } = await db
    .from("menu_items")
    .select("id,name,section,price,available")
    .order("section")
    .order("name");
  return (data ?? []) as MenuRow[];
}

const orderFields =
  "id,reference,status,total,note,version,created_at,paid_at,payment_method,payment_reference,reservations(reference),rooms(room_number),staff:profiles!orders_staff_id_fkey(full_name),order_items(name,unit_price,quantity)";

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
    section: z.enum(menuSections),
    price: z.coerce.number().min(0).max(100000),
    available: z.boolean(),
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
  saved: "Saved.",
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
