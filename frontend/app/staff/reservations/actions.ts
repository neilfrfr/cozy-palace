"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/authorize";
import { guestSchema, guestUpdateSchema } from "@/lib/operations/schema";
import { updateSchema } from "@/lib/reservations/schema";
import { publicError } from "@/lib/reservations/errors";
import type { ActionResult, Reservation } from "@/lib/reservations/types";
function refresh(id: string) {
  for (const path of [
    "/staff",
    "/staff/reservations",
    "/staff/reservations/" + id,
    "/admin",
    "/admin/activity",
    "/rooms",
    "/reservations",
    "/reservations/" + id,
  ])
    revalidatePath(path);
}
async function save(
  input: unknown,
  edit: boolean,
): Promise<ActionResult<Reservation>> {
  const p = (edit ? guestUpdateSchema : guestSchema).safeParse(input);
  if (!p.success) return { ok: false, code: "INVALID_INPUT" };
  const { db } = await requireStaff();
  const v = p.data;
  const args = {
    p_room_id: v.roomId,
    p_check_in: v.checkIn,
    p_check_out: v.checkOut,
    p_guests: v.guests,
    p_guest_full_name: v.guestFullName,
    p_guest_email: v.guestEmail ?? null,
    p_guest_phone: v.guestPhone ?? null,
  };
  const extra =
    "id" in v
      ? { p_id: v.id, p_version: v.version }
      : { p_idempotency_key: v.idempotencyKey };
  const { data, error } = await db.rpc(
    edit ? "update_guest_reservation" : "create_guest_reservation",
    { ...args, ...extra },
  );
  if (error) return { ok: false, code: publicError(error) };
  refresh(data.id);
  return { ok: true, data: data as Reservation };
}
export async function createGuestBookingAction(input: unknown) {
  return save(input, false);
}
export async function updateGuestBookingAction(input: unknown) {
  return save(input, true);
}
export async function updateOperationalBookingAction(
  input: unknown,
): Promise<ActionResult<Reservation>> {
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, code: "INVALID_INPUT" };
  const { db } = await requireStaff();
  const v = p.data;
  const { data, error } = await db.rpc("update_reservation", {
    p_id: v.id,
    p_version: v.version,
    p_room_id: v.roomId,
    p_check_in: v.checkIn,
    p_check_out: v.checkOut,
    p_guests: v.guests,
  });
  if (error) return { ok: false, code: publicError(error) };
  refresh(data.id);
  return { ok: true, data: data as Reservation };
}

export async function quoteGuestBookingAction(
  input: unknown,
  edit = false,
): Promise<
  ActionResult<{ total: number; nights: number; rate: number; room: string }>
> {
  const parsed = (edit ? guestUpdateSchema : guestSchema).safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const { db } = await requireStaff();
  const p = parsed.data;
  const { data: room, error } = await db
    .from("rooms")
    .select(
      "room_number,operational_state,room_types(name,nightly_rate,capacity)",
    )
    .eq("id", p.roomId)
    .maybeSingle();
  if (error || !room || room.operational_state !== "available")
    return { ok: false, code: "RESOURCE_UNAVAILABLE" };
  const type = room.room_types as unknown as {
    name: string;
    nightly_rate: number;
    capacity: number;
  };
  if (p.guests > type.capacity) return { ok: false, code: "CAPACITY_EXCEEDED" };
  let rate = Number(type.nightly_rate);
  if ("id" in p) {
    const { data: old, error: oldError } = await db
      .from("reservations")
      .select("version,room_bookings(room_id,rate_at_booking)")
      .eq("id", p.id)
      .neq("status", "draft")
      .maybeSingle();
    if (oldError || !old) return { ok: false, code: "NOT_FOUND" };
    if (old.version !== p.version)
      return { ok: false, code: "VERSION_CONFLICT" };
    const allocation = old.room_bookings as unknown as {
      room_id: string;
      rate_at_booking: number;
    } | null;
    if (allocation?.room_id === p.roomId)
      rate = Number(allocation.rate_at_booking);
  }
  const nights = (Date.parse(p.checkOut) - Date.parse(p.checkIn)) / 86400000;
  return {
    ok: true,
    data: {
      total: rate * nights,
      nights,
      rate,
      room: `${type.name} · Room ${room.room_number}`,
    },
  };
}
