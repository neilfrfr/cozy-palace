import { z } from "zod";
import { businessDate } from "@/lib/operations/schema";
/** Activity log action types and the stored actions each covers. Keep in step with the audit inserts in the migrations. */
export const activityTypes = {
  sign_in: { label: "Sign-ins", actions: ["signed_in"] },
  rooms: {
    label: "Room bookings",
    actions: [
      "create",
      "update",
      "submit",
      "delete",
      "confirmed",
      "checked_in",
      "completed",
      "cancelled",
      "expired",
      "hold_expired",
      "guest_booking_created",
      "guest_details_updated",
      "guest_online_created",
    ],
  },
  tables: {
    label: "Table bookings",
    actions: [
      "table_create",
      "table_cancel",
      "table_confirmed",
      "table_seated",
      "table_completed",
      "table_cancelled",
    ],
  },
  orders: {
    label: "Orders",
    actions: [
      "order_created",
      "order_completed",
      "order_cancelled",
      "order_paid",
    ],
  },
  payments: {
    label: "Payments and refunds",
    actions: ["payment_paid", "payment_review", "payment_refunded"],
  },
  inventory: {
    label: "Rates and inventory",
    actions: [
      "room_type_updated",
      "table_updated",
      "inventory_closed",
      "inventory_reopened",
      "menu_item_created",
      "menu_item_updated",
    ],
  },
  staff: {
    label: "Staff and accounts",
    actions: [
      "staff_created",
      "staff_updated",
      "staff_deleted",
      "staff_activated",
      "profile_updated",
    ],
  },
} as const;
export type ActivityType = keyof typeof activityTypes;
export type ActivityFilter = {
  page: number;
  employee?: string;
  type?: ActivityType;
};
export function parseActivityFilter(
  input: Record<string, string | string[] | undefined>,
): ActivityFilter {
  const text = (k: string) =>
    typeof input[k] === "string" ? (input[k] as string) : "";
  const employee = z.uuid().safeParse(text("employee")),
    type = z
      .enum(Object.keys(activityTypes) as [ActivityType, ...ActivityType[]])
      .safeParse(text("type"));
  return {
    page: Math.max(1, Math.min(10000, Math.floor(Number(text("page"))) || 1)),
    employee: employee.success ? employee.data : undefined,
    type: type.success ? type.data : undefined,
  };
}
/** The Manila calendar day containing `now`. Manila is UTC+8 all year (no DST). */
export function manilaDay(now = new Date()) {
  const start = new Date(businessDate(now) + "T00:00:00+08:00");
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
type LogRow = {
  id: string;
  action: string;
  record_id: string;
  occurred_at: string;
};
/**
 * A shift runs from the first sign-in of the Manila day to the end of that day.
 * `rows` are one employee's log rows for the day, oldest first. With no sign-in today
 * (a session carried over midnight) the whole day counts.
 */
export function shiftOf(rows: LogRow[]) {
  const first = rows.findIndex((r) => r.action === "signed_in");
  const signIn = rows[first];
  const actions = rows
    .slice(Math.max(first, 0))
    .filter((r) => r.action !== "signed_in")
    .reverse();
  const counts = new Map<string, number>();
  for (const r of actions) {
    const label =
      Object.values(activityTypes).find((t) =>
        (t.actions as readonly string[]).includes(r.action),
      )?.label ?? "Other";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return {
    signedInAt: signIn?.occurred_at ?? null,
    actions,
    counts: [...counts],
  };
}
