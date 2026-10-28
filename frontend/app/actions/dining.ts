"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { readRole } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { mutationSchema } from "@/lib/reservations/schema";
import { publicError } from "@/lib/reservations/errors";
import type { ActionResult } from "@/lib/reservations/types";
import {
  diningSlots,
  slotStart,
  tableBookingSchema,
  tableStatuses,
  walkInSchema,
  guestOnlineTableSchema,
} from "@/lib/dining";

type Saved = { id: string; reference: string; status: string };

async function identity() {
  if (!isConfigured()) return null;
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  return { db, role: await readRole(db, data.user.id) };
}
function refresh() {
  for (const path of [
    "/dining",
    "/reservations",
    "/staff/tables",
    "/admin/activity",
  ])
    revalidatePath(path);
}
async function rpc(
  db: Awaited<ReturnType<typeof createClient>>,
  name: string,
  args: Record<string, unknown>,
): Promise<ActionResult<Saved>> {
  const { data, error } = await db.rpc(name, args);
  if (error) return { ok: false, code: publicError(error) };
  refresh();
  return { ok: true, data: data as Saved };
}

/** Table ids already taken for a seating, so the floor plan can grey them out. */
export async function bookedTablesAction(input: unknown): Promise<string[]> {
  const p = z
    .object({ date: z.iso.date(), time: z.enum(diningSlots) })
    .strict()
    .safeParse(input);
  if (!p.success || !isConfigured()) return [];
  const db = await createClient();
  const { data, error } = await db.rpc("booked_tables", {
    p_start_at: slotStart(p.data.date, p.data.time),
  });
  if (error) return [];
  return (data ?? []).map((r: { table_id: string }) => r.table_id);
}

export async function bookTableAction(
  input: unknown,
): Promise<ActionResult<Saved>> {
  const who = await identity();
  if (!who) {
    if (!isConfigured()) return { ok: false, code: "SETUP_REQUIRED" };
    const parsed = guestOnlineTableSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
    const p = parsed.data;
    const db = await createClient();
    return rpc(db, "create_guest_table_booking", {
      p_table_id: p.tableId,
      p_start_at: slotStart(p.date, p.time),
      p_guests: p.guests,
      p_guest_full_name: p.guestFullName,
      p_guest_email: p.guestEmail,
      p_guest_phone: p.guestPhone,
      p_idempotency_key: p.idempotencyKey,
    });
  }
  const guest = who.role !== "customer" ? walkInSchema.safeParse(input) : null;
  const parsed = guest ?? tableBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const p = parsed.data;
  return rpc(who.db, "book_table", {
    p_table_id: p.tableId,
    p_start_at: slotStart(p.date, p.time),
    p_guests: p.guests,
    p_idempotency_key: p.idempotencyKey,
    ...(guest?.success && {
      p_guest_full_name: guest.data.guestFullName,
      p_guest_email: guest.data.guestEmail ?? null,
      p_guest_phone: guest.data.guestPhone ?? null,
    }),
  });
}

export async function cancelTableBookingAction(
  input: unknown,
): Promise<ActionResult<Saved>> {
  const p = mutationSchema.safeParse(input);
  if (!p.success) return { ok: false, code: "INVALID_INPUT" };
  const who = await identity();
  if (!who) return { ok: false, code: "UNAUTHORIZED" };
  if (who.role !== "customer") return { ok: false, code: "FORBIDDEN" };
  return rpc(who.db, "cancel_table_booking", {
    p_id: p.data.id,
    p_version: p.data.version,
  });
}

export async function setTableBookingStatusAction(
  input: unknown,
): Promise<ActionResult<Saved>> {
  const p = mutationSchema
    .extend({ status: z.enum(tableStatuses) })
    .safeParse(input);
  if (!p.success) return { ok: false, code: "INVALID_INPUT" };
  const who = await identity();
  if (!who) return { ok: false, code: "UNAUTHORIZED" };
  if (who.role === "customer") return { ok: false, code: "FORBIDDEN" };
  return rpc(who.db, "set_table_booking_status", {
    p_id: p.data.id,
    p_version: p.data.version,
    p_status: p.data.status,
  });
}
