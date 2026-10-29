import "server-only";
import { requireCustomer, requireStaff } from "@/lib/auth/authorize";
import type { TableBooking } from "@/lib/dining";

const columns =
  "id,reference,status,guests,version,booking_source,guest_full_name,guest_phone,table_bookings!inner(start_at,end_at,restaurant_tables(table_number))";

export async function getMyTableBookings(
  reference = "",
): Promise<TableBooking[]> {
  const { db, userId } = await requireCustomer();
  let query = db
    .from("reservations")
    .select(columns)
    .eq("kind", "dining")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (reference) query = query.ilike("reference", `%${reference}%`);
  const { data, error } = await query;
  if (error)
    throw new Error("Table bookings could not be loaded. Please try again.");
  return data as unknown as TableBooking[];
}

/** Table bookings seated on one Manila day, or from that day onward when no end is given. */
export async function getTableBookings(
  from: string,
  to?: string,
): Promise<TableBooking[]> {
  const { db } = await requireStaff();
  let query = db
    .from("reservations")
    .select(
      columns + ",customer:profiles!reservations_customer_id_fkey(full_name)",
    )
    .eq("kind", "dining")
    .neq("status", "draft")
    .gte("table_bookings.start_at", from + "T00:00:00+08:00")
    .limit(200);
  if (to) query = query.lt("table_bookings.start_at", to + "T00:00:00+08:00");
  const { data, error } = await query;
  if (error)
    throw new Error("Table bookings could not be loaded. Please try again.");
  // Order by seating time; PostgREST can't order parents by an embedded column.
  return (data as unknown as TableBooking[]).sort((a, b) =>
    a.table_bookings.start_at.localeCompare(b.table_bookings.start_at),
  );
}
