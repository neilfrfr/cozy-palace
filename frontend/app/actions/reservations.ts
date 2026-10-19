"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { readRole } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import {
  reservationSchema,
  mutationSchema,
  updateSchema,
} from "@/lib/reservations/schema";
import { publicError } from "@/lib/reservations/errors";
import type { ActionResult, Reservation } from "@/lib/reservations/types";
async function invoke(
  name: string,
  args: Record<string, unknown>,
): Promise<ActionResult<Reservation>> {
  if (!isConfigured()) return { ok: false, code: "SETUP_REQUIRED" };
  const db = await createClient();
  const { data: user, error: identityError } = await db.auth.getUser();
  if (identityError || !user.user) return { ok: false, code: "UNAUTHORIZED" };
  const role = await readRole(db, user.user.id);
  if (
    name === "transition_reservation"
      ? role === "customer"
      : role !== "customer"
  )
    return { ok: false, code: "FORBIDDEN" };
  const { data, error } = await db.rpc(name, args);
  if (error) return { ok: false, code: publicError(error) };
  for (const path of [
    "/reservations",
    "/rooms",
    "/staff/reservations",
    "/admin/activity",
    "/staff",
    "/admin",
  ])
    revalidatePath(path);
  return { ok: true, data: data as Reservation };
}
export async function createReservationAction(
  input: unknown,
): Promise<ActionResult<Reservation>> {
  const parsed = reservationSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  const p = parsed.data;
  return invoke("create_reservation", {
    p_room_id: p.roomId,
    p_check_in: p.checkIn,
    p_check_out: p.checkOut,
    p_guests: p.guests,
    p_idempotency_key: p.idempotencyKey,
  });
}
export async function updateReservationAction(
  input: unknown,
): Promise<ActionResult<Reservation>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const p = parsed.data;
  const result = await invoke("update_reservation", {
    p_id: p.id,
    p_version: p.version,
    p_room_id: p.roomId,
    p_check_in: p.checkIn,
    p_check_out: p.checkOut,
    p_guests: p.guests,
  });
  if (result.ok) revalidatePath("/reservations/" + p.id);
  return result;
}
export async function deleteDraftAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const p = mutationSchema.safeParse(input);
  if (!p.success) return { ok: false, code: "INVALID_INPUT" };
  return invoke("delete_draft", { p_id: p.data.id, p_version: p.data.version });
}
export async function submitReservationAction(
  input: unknown,
): Promise<ActionResult<Reservation>> {
  const p = mutationSchema.safeParse(input);
  if (!p.success) return { ok: false, code: "INVALID_INPUT" };
  const result = await invoke("submit_reservation", {
    p_id: p.data.id,
    p_version: p.data.version,
  });
  if (result.ok) revalidatePath("/reservations/" + p.data.id);
  return result;
}
export async function transitionReservationAction(
  input: unknown,
): Promise<ActionResult<Reservation>> {
  const p = mutationSchema
    .extend({
      status: z.enum([
        "confirmed",
        "cancelled",
        "checked_in",
        "completed",
        "expired",
      ]),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, code: "INVALID_INPUT" };
  return invoke("transition_reservation", {
    p_id: p.data.id,
    p_version: p.data.version,
    p_status: p.data.status,
  });
}
