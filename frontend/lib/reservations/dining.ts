import "server-only";
import { requireCustomer, requireStaff } from "@/lib/auth/authorize";
import { addDays } from "./availability";
import type { TableBooking } from "@/lib/dining";

const columns =
  "id,reference,status,guests,version,booking_source,guest_full_name,guest_phone,table_bookings!inner(start_at,end_at,restaurant_tables(table_number))";

export async function getMyTableBookings(): Promise<TableBooking[]> {
  const { db, userId } = await requireCustomer();
  const { data, error } = await db
    .from("reservations")
    .select(columns)
    .eq("kind", "dining")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    throw new Error("Table bookings could not be loaded. Please try again.");
  return data as unknown as TableBooking[];
}

/** Every table booking whose seating starts on a Manila calendar day. */
export async function getTableBookingsForDay(
  date: string,
): Promise<TableBooking[]> {
  const { db } = await requireStaff();
  const { data, error } = await db
    .from("reservations")
    .select(
      columns + ",customer:profiles!reservations_customer_id_fkey(full_name)",
    )
    .eq("kind", "dining")
    .neq("status", "draft")
    .gte("table_bookings.start_at", date + "T00:00:00+08:00")
    .lt("table_bookings.start_at", addDays(date, 1) + "T00:00:00+08:00")
    .limit(200);
  if (error)
    throw new Error("Table bookings could not be loaded. Please try again.");
  // Order by seating time; PostgREST can't order parents by an embedded column.
  return (data as unknown as TableBooking[]).sort((a, b) =>
    a.table_bookings.start_at.localeCompare(b.table_bookings.start_at),
  );
}
