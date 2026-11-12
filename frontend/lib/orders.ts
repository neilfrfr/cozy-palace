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

/** RLS limits customers to their own orders; staff see all unless a customer is given. */
export async function getOrders(
  customerId?: string,
  limit = 50,
): Promise<Order[]> {
  const db = await createClient();
  let query = db
    .from("orders")
    .select(
      "id,reference,status,total,note,version,created_at,paid_at,payment_method,payment_reference,reservations(reference),order_items(name,unit_price,quantity)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (customerId) query = query.eq("customer_id", customerId);
  const { data } = await query;
  return (data ?? []) as unknown as Order[];
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

export const orderMessages: Record<string, string> = {
  created: "Order saved.",
  paid: "Payment recorded.",
  saved: "Saved.",
  FORBIDDEN: "You do not have access to this.",
  NOT_FOUND:
    "No reservation has that reference. Check it, or leave it blank for a walk-in.",
  VERSION_CONFLICT:
    "This order changed in the meantime. Check it and try again.",
  INVALID_INPUT:
    "Pick at least one available item (1–50 each) and check the details.",
  INVALID_TRANSITION:
    "This order can't be changed now. Paid orders can't be cancelled, and an order is paid only once.",
};
