import "server-only";
import { requireStaff } from "@/lib/auth/authorize";
import { normalizeReservation } from "@/lib/reservations/normalize";
import type { Reservation } from "@/lib/reservations/types";
import {
  businessDate,
  parseOperationsFilter,
  type OperationsFilter,
} from "./schema";
export type OperationalReservation = Reservation & {
  customer_name: string | null;
  creator_name: string | null;
  room_number: string;
  room_type_name: string;
};
export async function getOperationalReservations(
  filter: OperationsFilter = parseOperationsFilter({}),
) {
  const { db } = await requireStaff();
  const { data, error } = await db.rpc("operational_queue", {
    p_query: filter.q,
    p_date: filter.date ?? null,
    p_status: filter.status ?? null,
    p_source: filter.source ?? null,
    p_page: filter.page,
    p_staying: filter.staying,
  });
  if (error)
    throw Error(
      "The operations queue could not be loaded. Check the guest-booking migrations and try again.",
    );
  return {
    rows: (data.rows as unknown[]).map(
      (r) => normalizeReservation(r) as OperationalReservation,
    ),
    count: Number(data.count),
  };
}
export async function getOperationalReservation(
  id: string,
): Promise<OperationalReservation | null> {
  const { db } = await requireStaff();
  const { data, error } = await db
    .from("reservations")
    .select(
      "*,customer:profiles!reservations_customer_id_fkey(full_name),creator:profiles!reservations_created_by_fkey(full_name),room_bookings(*,rooms(room_number,room_types(name)))",
    )
    .eq("id", id)
    .neq("status", "draft")
    .maybeSingle();
  if (error) throw Error("The reservation could not be loaded.");
  if (!data) return null;
  const raw = data as unknown as {
    customer: { full_name: string } | null;
    creator: { full_name: string } | null;
    room_bookings: {
      rooms: { room_number: string; room_types: { name: string } };
    } | null;
  };
  return {
    ...normalizeReservation(data),
    customer_name: raw.customer?.full_name ?? null,
    creator_name: raw.creator?.full_name ?? null,
    room_number: raw.room_bookings?.rooms?.room_number ?? "Unavailable",
    room_type_name: raw.room_bookings?.rooms?.room_types?.name ?? "Unavailable",
  };
}
export async function getStaffDashboard() {
  const date = businessDate();
  const definitions: { name: string; filter: Record<string, string> }[] = [
    { name: "Pending confirmations", filter: { status: "pending" } },
    { name: "Today's arrivals", filter: { status: "confirmed", date } },
    {
      name: "Stays in house",
      filter: { status: "checked_in", date, staying: "1" },
    },
  ];
  return {
    date,
    metrics: await Promise.all(
      definitions.map(async (item) => ({
        name: item.name,
        count: (
          await getOperationalReservations(parseOperationsFilter(item.filter))
        ).count,
        href: "/staff/reservations?" + new URLSearchParams(item.filter),
      })),
    ),
  };
}

export async function getManagementDashboard() {
  const { db } = await requireStaff(true);
  const names = [
    "rooms",
    "restaurant_tables",
    "staff_members",
    "reservations",
  ] as const;
  const [counts, pending, statuses, recent] = await Promise.all([
    Promise.all(
      names.map(async (name) => {
        const r = await db
          .from(name)
          .select("id", { count: "exact", head: true });
        if (r.error) throw Error("Management counts are unavailable.");
        return { name, count: r.count ?? 0 };
      }),
    ),
    db
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending"),
    Promise.all(
      [
        "pending",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "expired",
      ].map(async (status) => {
        const r = await db
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("kind", "hotel")
          .eq("status", status);
        if (r.error) throw Error("Reservation counts are unavailable.");
        return { status, count: r.count ?? 0 };
      }),
    ),
    db
      .from("audit_logs")
      .select("id,actor_name,actor_role,action,record_id,occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(6),
  ]);
  if (pending.error || recent.error)
    throw Error("Management activity could not be loaded.");
  const ids = (recent.data ?? []).map((r) => r.record_id);
  const refs = ids.length
    ? await db.from("reservations").select("id,reference").in("id", ids)
    : { data: [], error: null };
  if (refs.error) throw Error("Activity references could not be loaded.");
  return {
    counts,
    pendingStaff: pending.count ?? 0,
    statuses,
    recent: (recent.data ?? []).map((r) => ({
      ...r,
      reference:
        refs.data?.find((v) => v.id === r.record_id)?.reference ?? null,
    })),
  };
}
