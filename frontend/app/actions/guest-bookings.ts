"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyCaptcha,
  visitorBookingEnabled,
  type CaptchaAction,
} from "@/lib/captcha";
import { sendBookingEmail } from "@/lib/email";
import { visitorSchema } from "@/lib/operations/schema";
import { slotStart, visitorTableSchema } from "@/lib/dining";
import { publicError } from "@/lib/reservations/errors";
import { nights, roomQuote } from "@/lib/reservations/quote";
import type { ActionResult } from "@/lib/reservations/types";
type Booked = ActionResult<{ reference: string }>;
export async function quoteStayAction(
  input: unknown,
): Promise<
  ActionResult<{ total: number; nights: number; rate: number; room: string }>
> {
  const parsed = visitorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (!visitorBookingEnabled()) return { ok: false, code: "REQUEST_FAILED" };
  const p = parsed.data;
  const quote = await roomQuote(await createClient(), p.roomId, p.guests);
  if (!quote.ok) return quote;
  const count = nights(p.checkIn, p.checkOut);
  return {
    ok: true,
    data: {
      total: quote.rate * count,
      nights: count,
      rate: quote.rate,
      room: quote.room,
    },
  };
}
/** Checks the CAPTCHA, books through the server-only RPC, then emails the visitor their booking. */
async function bookAsVisitor(
  captchaToken: unknown,
  action: CaptchaAction,
  rpc: string,
  args: Record<string, unknown>,
  email: (b: {
    id: string;
    reference: string;
  }) => Parameters<typeof sendBookingEmail>[0],
): Promise<Booked> {
  if (!visitorBookingEnabled()) return { ok: false, code: "REQUEST_FAILED" };
  const h = await headers();
  // Vercel sets x-real-ip itself; the forwarded chain is the local fallback.
  const ip =
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
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
  // The booking stands even if the email fails; the reference is also shown on screen.
  after(() => sendBookingEmail(email(booked)));
  return { ok: true, data: { reference: booked.reference } };
}
export async function bookAsGuestAction(
  input: unknown,
  captchaToken: unknown,
): Promise<Booked> {
  const parsed = visitorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const p = parsed.data;
  return bookAsVisitor(
    captchaToken,
    "book_room",
    "book_as_guest",
    {
      p_room_id: p.roomId,
      p_check_in: p.checkIn,
      p_check_out: p.checkOut,
      p_guests: p.guests,
      p_guest_full_name: p.guestFullName,
      p_guest_email: p.guestEmail,
      p_guest_phone: p.guestPhone,
      p_idempotency_key: p.idempotencyKey,
    },
    (b) => ({
      ...b,
      to: p.guestEmail,
      name: p.guestFullName,
      booking: `a stay from ${p.checkIn} to ${p.checkOut}`,
      guests: p.guests,
      next: "We hold the room for 24 hours, or until your check-in day if that is sooner. Our staff will contact you to confirm it and arrange payment.",
    }),
  );
}
export async function bookTableAsGuestAction(
  input: unknown,
  captchaToken: unknown,
): Promise<Booked> {
  const parsed = visitorTableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const p = parsed.data;
  return bookAsVisitor(
    captchaToken,
    "book_table",
    "book_table_as_guest",
    {
      p_table_id: p.tableId,
      p_start_at: slotStart(p.date, p.time),
      p_guests: p.guests,
      p_guest_full_name: p.guestFullName,
      p_guest_email: p.guestEmail,
      p_guest_phone: p.guestPhone,
      p_idempotency_key: p.idempotencyKey,
    },
    (b) => ({
      ...b,
      to: p.guestEmail,
      name: p.guestFullName,
      booking: `a table on ${p.date} at ${p.time}`,
      guests: p.guests,
      next: "We hold the table until our staff confirm it. Seatings last two hours.",
    }),
  );
}
