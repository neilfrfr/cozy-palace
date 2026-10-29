import { z } from "zod";
import { reservationSchema, updateSchema } from "@/lib/reservations/schema";
import { isValidPhone } from "@/lib/phone";
const optional = <T extends z.ZodType<string>>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    schema.optional(),
  );
export const guestFields = {
  guestFullName: z.string().trim().min(1).max(100),
  guestEmail: optional(z.email().trim().max(254)),
  guestPhone: optional(z.string().trim().max(32).refine(isValidPhone)),
};
export const guestSchema = reservationSchema.extend(guestFields);
export const guestUpdateSchema = updateSchema.extend(guestFields);
export const operationalStatuses = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "expired",
] as const;
export type OperationsFilter = {
  q: string;
  page: number;
  date?: string;
  status?: (typeof operationalStatuses)[number];
  source?: "customer_online" | "staff_guest" | "guest_online";
  staying: boolean;
};
export function parseOperationsFilter(
  input: Record<string, string | string[] | undefined>,
): OperationsFilter {
  const text = (k: string) =>
    typeof input[k] === "string" ? (input[k] as string) : "";
  const date = z.iso.date().safeParse(text("date")),
    status = z.enum(operationalStatuses).safeParse(text("status")),
    source = z
      .enum(["customer_online", "staff_guest", "guest_online"])
      .safeParse(text("source")),
    page = Number(text("page"));
  return {
    q: text("q").trim().slice(0, 100),
    page: Number.isFinite(page)
      ? Math.max(1, Math.min(10000, Math.floor(page) || 1))
      : 1,
    date: date.success ? date.data : undefined,
    status: status.success ? status.data : undefined,
    source: source.success ? source.data : undefined,
    staying: text("staying") === "1",
  };
}
export function businessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const p = (t: string) => parts.find((v) => v.type === t)!.value;
  return `${p("year")}-${p("month")}-${p("day")}`;
}
