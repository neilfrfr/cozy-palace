import { z } from "zod";
export const extraPricing = ["per_night", "per_stay"] as const;
export type Extra = {
  id: string;
  name: string;
  description: string;
  kind: "extra" | "package";
  price: number;
  pricing: (typeof extraPricing)[number];
  max_quantity: number;
  active: boolean;
};
/** The snapshot a booking keeps of each extra it was booked with. */
export type BookedExtra = {
  name: string;
  unit_price: number;
  pricing: Extra["pricing"];
  quantity: number;
  line_total: number;
};
/** Keep in step with private.price_extras. */
export const lineTotal = (
  e: { unit_price: number; pricing: Extra["pricing"]; quantity: number },
  nights: number,
) =>
  Number(e.unit_price) * e.quantity * (e.pricing === "per_night" ? nights : 1);
export const extrasTotal = (
  lines: Parameters<typeof lineTotal>[0][],
  nights: number,
) => lines.reduce((sum, e) => sum + lineTotal(e, nights), 0);

/** What the browser may send: ids and quantities only. Prices always come from the database. */
export const extrasInput = z
  .array(
    z
      .object({ id: z.uuid(), quantity: z.number().int().min(1).max(20) })
      .strict(),
  )
  .max(20)
  .refine((a) => new Set(a.map((e) => e.id)).size === a.length)
  .default([]);
export type ExtrasInput = z.infer<typeof extrasInput>;
/** Reads the extras picker's "extra:<id>" quantity inputs, skipping zeros. */
export function extrasFromForm(form: FormData): ExtrasInput {
  return [...form.entries()].flatMap(([k, v]) => {
    const quantity = Number(v || 0);
    return k.startsWith("extra:") && quantity
      ? [{ id: k.slice(6), quantity }]
      : [];
  });
}
/**
 * Prices the chosen extras against the current active items, for the review step.
 * The database prices them again when the booking is saved.
 */
export function priceExtras(
  chosen: ExtrasInput,
  items: Extra[],
  nights: number,
): BookedExtra[] | null {
  const lines: BookedExtra[] = [];
  for (const c of chosen) {
    const item = items.find((i) => i.id === c.id && i.active);
    if (!item || c.quantity < 1 || c.quantity > item.max_quantity) return null;
    const line = {
      name: item.name,
      unit_price: Number(item.price),
      pricing: item.pricing,
      quantity: c.quantity,
    };
    lines.push({ ...line, line_total: lineTotal(line, nights) });
  }
  return lines;
}
const peso = (n: number) => "₱" + Number(n).toLocaleString("en-PH");
export const pricingLabel = (p: Extra["pricing"]) =>
  p === "per_night" ? "per night" : "per stay";
/** "Extra mattress × 1 (₱1,600) · Amenity kit × 2 (₱500)", or "None". */
export const extrasSummary = (lines: BookedExtra[] = []) =>
  lines
    .map((e) => `${e.name} × ${e.quantity} (${peso(e.line_total)})`)
    .join(" · ") || "None";

export const extraSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300),
    kind: z.enum(["extra", "package"]),
    price: z.coerce.number().min(0).max(100000),
    pricing: z.enum(extraPricing),
    maxQuantity: z.coerce.number().int().min(1).max(20),
    active: z.boolean(),
  })
  .strict();
