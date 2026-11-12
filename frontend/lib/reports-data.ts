import "server-only";
import { requireStaff } from "@/lib/auth/authorize";
import {
  addDays,
  occupancy,
  revenueByRoomType,
  type Transaction,
} from "@/lib/reports";

const manilaMidnight = (d: string) => d + "T00:00:00+08:00";

/** Admin-only figures for [from, to] (inclusive hotel dates). */
export async function getReport(from: string, to: string) {
  const { db } = await requireStaff(true);
  const end = addDays(to, 1);
  // Revenue counts money on the day it moved: payment paid_at, room bill settlement (order paid_at), refund completion.
  const stayType = "room_bookings(rooms(room_types(name)))";
  const [
    rooms,
    stays,
    closures,
    dining,
    payments,
    orders,
    types,
    refunds,
    manualRefunds,
  ] = await Promise.all([
    db.from("rooms").select("id").eq("operational_state", "available"),
    db
      .from("room_bookings")
      .select("room_id,check_in,check_out,reservations!inner(status)")
      .lt("check_in", end)
      .gt("check_out", from),
    db
      .from("resource_blocks")
      .select("room_id,starts_on,ends_on")
      .not("room_id", "is", null)
      .lt("starts_on", end)
      .gt("ends_on", from),
    db
      .from("table_bookings")
      .select("reservations!inner(status)")
      .gte("start_at", manilaMidnight(from))
      .lt("start_at", manilaMidnight(end)),
    // shortcut: refund rows show as status "refunded" once feat/refunds merges; refunder attribution comes with it.
    db
      .from("payments")
      .select(
        `status,amount_paid,paid_at,provider_payment_id,reservations(reference,reservation_extras(line_total),${stayType})`,
      )
      .in("status", ["paid", "review", "refunded"])
      .gte("paid_at", manilaMidnight(from))
      .lt("paid_at", manilaMidnight(end))
      .order("paid_at"),
    db
      .from("orders")
      .select(
        "reference,total,paid_at,payment_method,payment_reference,cashier:profiles!orders_paid_by_fkey(full_name),rooms(room_types(name))",
      )
      .not("paid_at", "is", null)
      .gte("paid_at", manilaMidnight(from))
      .lt("paid_at", manilaMidnight(end))
      .order("paid_at"),
    db.from("room_types").select("name").order("name"),
    db
      .from("refunds")
      .select(`amount,payments(reservations(${stayType}))`)
      .eq("status", "succeeded")
      .gte("completed_at", manilaMidnight(from))
      .lt("completed_at", manilaMidnight(end)),
    // Refunds recorded by hand (mark_payment_refunded) are whatever Xendit refunds had not already returned.
    db
      .from("payments")
      .select(`amount_paid,refunds(amount,status),reservations(${stayType})`)
      .eq("status", "refunded")
      .gte("refunded_at", manilaMidnight(from))
      .lt("refunded_at", manilaMidnight(end)),
  ]);
  const failed = [
    rooms,
    stays,
    closures,
    dining,
    payments,
    orders,
    types,
    refunds,
    manualRefunds,
  ].find((r) => r.error);
  if (failed)
    throw new Error("The report could not be loaded. Please try again.");

  type One<T> = T | T[] | null;
  const one = <T>(v: One<T>) => (Array.isArray(v) ? v[0] : v) ?? null;
  const status = (r: { reservations: One<{ status: string }> }) =>
    one(r.reservations)?.status ?? "";

  const transactions: Transaction[] = [
    ...payments.data!.map((p) => ({
      date: p.paid_at!,
      kind: "Booking payment" as const,
      reference:
        one(p.reservations as One<{ reference: string }>)?.reference ?? "",
      amount: Number(p.amount_paid ?? 0),
      method: "Xendit " + (p.provider_payment_id ?? ""),
      status: p.status,
      recordedBy: "Xendit",
    })),
    ...orders.data!.map((o) => ({
      date: o.paid_at!,
      kind: "Order" as const,
      reference: o.reference,
      amount: Number(o.total),
      method:
        (o.payment_method === "gcash" ? "GCash" : (o.payment_method ?? "")) +
        (o.payment_reference ? " " + o.payment_reference : ""),
      status: "paid",
      recordedBy: one(o.cashier as One<{ full_name: string }>)?.full_name ?? "",
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  type Room = One<{ room_types: One<{ name: string }> }>;
  type Stay = { room_bookings: One<{ rooms: Room }> };
  const roomType = (room: Room) =>
    one(one(room)?.room_types ?? null)?.name ?? "No room";
  const typeOf = (r: One<Stay>) =>
    roomType(one(one(r)?.room_bookings ?? null)?.rooms ?? null);
  const revenue = revenueByRoomType(
    types.data!.map((t) => t.name),
    payments.data!.map((p) => {
      const r = one(
        p.reservations as One<
          Stay & { reservation_extras: { line_total: number }[] }
        >,
      );
      return {
        type: typeOf(r),
        paid: Number(p.amount_paid ?? 0),
        extras: (r?.reservation_extras ?? []).reduce(
          (n, e) => n + Number(e.line_total),
          0,
        ),
      };
    }),
    [
      ...refunds.data!.map((f) => ({
        type: typeOf(
          one(f.payments as One<{ reservations: One<Stay> }>)?.reservations ??
            null,
        ),
        amount: Number(f.amount),
      })),
      ...manualRefunds.data!.map((p) => ({
        type: typeOf(p.reservations as One<Stay>),
        amount:
          Number(p.amount_paid ?? 0) -
          (p.refunds as { amount: number; status: string }[])
            .filter((f) => f.status === "succeeded")
            .reduce((n, f) => n + Number(f.amount), 0),
      })),
    ].filter((f) => f.amount > 0),
    orders
      .data!.filter((o) => o.rooms)
      .map((o) => ({
        type: roomType(o.rooms as Room),
        amount: Number(o.total),
      })),
  );

  const diningCounts: Record<string, number> = {};
  for (const d of dining.data!) {
    const s = status(d as { reservations: One<{ status: string }> });
    diningCounts[s] = (diningCounts[s] ?? 0) + 1;
  }
  return {
    occupancy: occupancy(
      from,
      to,
      rooms.data!.map((r) => r.id),
      stays.data!.map((s) => ({
        room_id: s.room_id,
        check_in: s.check_in,
        check_out: s.check_out,
        status: status(s as { reservations: One<{ status: string }> }),
      })),
      closures.data!,
    ),
    dining: diningCounts,
    revenue,
    transactions,
  };
}
