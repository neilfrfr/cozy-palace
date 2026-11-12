"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyCaptcha,
  visitorBookingEnabled,
  type CaptchaAction,
} from "@/lib/captcha";
import { clientIp } from "@/lib/client-ip";
import { deliverNotifications } from "@/lib/notifications";
import { visitorSchema } from "@/lib/operations/schema";
import { slotStart, visitorTableSchema } from "@/lib/dining";
import { publicError } from "@/lib/reservations/errors";
import { extrasQuote, nights, roomQuote } from "@/lib/reservations/quote";
import type { BookedExtra } from "@/lib/extras";
import type { ActionResult } from "@/lib/reservations/types";
type Booked = ActionResult<{ reference: string }>;
export async function quoteStayAction(input: unknown): Promise<
  ActionResult<{
    total: number;
    nights: number;
    rate: number;
    room: string;
    extras: BookedExtra[];
  }>
> {
  const parsed = visitorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (!visitorBookingEnabled()) return { ok: false, code: "REQUEST_FAILED" };
  const p = parsed.data;
  const db = await createClient();
  const quote = await roomQuote(db, p.roomId, p.guests);
  if (!quote.ok) return quote;
  const count = nights(p.checkIn, p.checkOut);
  const extras = await extrasQuote(db, p.extras, count);
  if (!extras) return { ok: false, code: "EXTRAS_UNAVAILABLE" };
  return {
    ok: true,
    data: {
      total: quote.rate * count + extras.reduce((s, e) => s + e.line_total, 0),
      nights: count,
      rate: quote.rate,
      room: quote.room,
      extras,
    },
  };
}
/** Checks the CAPTCHA, books through the server-only RPC, then sends the queued booking email. */
async function bookAsVisitor(
  captchaToken: unknown,
  action: CaptchaAction,
  rpc: string,
  args: Record<string, unknown>,
): Promise<Booked> {
  if (!visitorBookingEnabled()) return { ok: false, code: "REQUEST_FAILED" };
  const ip = await clientIp();
  if (!(await verifyCaptcha(String(captchaToken ?? ""), ip, action)))
    return { ok: false, code: "CAPTCHA_FAILED" };
  const { data, error } = await createAdminClient().rpc(rpc, {
    ...args,
    p_client_ip: ip,
  });
  if (error) return { ok: false, code: publicError(error) };
  for (const path of [
    "/rooms",
    "/dining",
    "/staff",
    "/staff/reservations",
    "/staff/tables",
    "/admin",
  ])
    revalidatePath(path);
  const booked = data as { id: string; reference: string };
  // The booking stands even if the email fails; it is retried later and the reference is shown on screen.
  after(() => deliverNotifications());
  return { ok: true, data: { reference: booked.reference } };
}
export async function bookAsGuestAction(
  input: unknown,
  captchaToken: unknown,
): Promise<Booked> {
  const parsed = visitorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const p = parsed.data;
  return bookAsVisitor(captchaToken, "book_room", "book_as_guest", {
    p_room_id: p.roomId,
    p_check_in: p.checkIn,
    p_check_out: p.checkOut,
    p_guests: p.guests,
    p_guest_full_name: p.guestFullName,
    p_guest_email: p.guestEmail,
    p_guest_phone: p.guestPhone,
    p_idempotency_key: p.idempotencyKey,
    p_extras: p.extras,
  });
}
export async function bookTableAsGuestAction(
  input: unknown,
  captchaToken: unknown,
): Promise<Booked> {
  const parsed = visitorTableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const p = parsed.data;
  return bookAsVisitor(captchaToken, "book_table", "book_table_as_guest", {
    p_table_id: p.tableId,
    p_start_at: slotStart(p.date, p.time),
    p_guests: p.guests,
    p_guest_full_name: p.guestFullName,
    p_guest_email: p.guestEmail,
    p_guest_phone: p.guestPhone,
    p_idempotency_key: p.idempotencyKey,
  });
}
