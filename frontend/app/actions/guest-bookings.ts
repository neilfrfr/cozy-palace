"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCaptcha, visitorBookingEnabled } from "@/lib/captcha";
import { sendBookingLink } from "@/lib/email";
import { siteOrigin } from "@/lib/accounts/site-url";
import { visitorSchema, guestLinkToken } from "@/lib/operations/schema";
import { publicError } from "@/lib/reservations/errors";
import { nights, roomQuote } from "@/lib/reservations/quote";
import type { ActionResult } from "@/lib/reservations/types";
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
export async function bookAsGuestAction(
  input: unknown,
  captchaToken: unknown,
): Promise<ActionResult<{ token: string }>> {
  const parsed = visitorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (!visitorBookingEnabled()) return { ok: false, code: "REQUEST_FAILED" };
  const p = parsed.data;
  const h = await headers();
  // Vercel sets x-real-ip itself; the forwarded chain is the local fallback.
  const ip =
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await verifyCaptcha(String(captchaToken ?? ""), ip)))
    return { ok: false, code: "CAPTCHA_FAILED" };
  const { data, error } = await createAdminClient().rpc("book_as_guest", {
    p_room_id: p.roomId,
    p_check_in: p.checkIn,
    p_check_out: p.checkOut,
    p_guests: p.guests,
    p_guest_full_name: p.guestFullName,
    p_guest_email: p.guestEmail,
    p_guest_phone: p.guestPhone,
    p_idempotency_key: p.idempotencyKey,
    p_client_ip: ip,
  });
  if (error) return { ok: false, code: publicError(error) };
  for (const path of ["/rooms", "/staff", "/staff/reservations", "/admin"])
    revalidatePath(path);
  const { token, reference } = data as { token: string; reference: string };
  const origin = siteOrigin();
  // The booking stands even if the email fails; the link is also shown on screen.
  if (origin)
    after(() =>
      sendBookingLink({
        to: p.guestEmail,
        name: p.guestFullName,
        reference,
        checkIn: p.checkIn,
        checkOut: p.checkOut,
        guests: p.guests,
        link: `${origin}/stay/${token}`,
      }),
    );
  return { ok: true, data: { token } };
}
export async function cancelGuestBookingAction(
  _: { code: string } | null,
  form: FormData,
): Promise<{ code: string }> {
  const token = guestLinkToken.safeParse(form.get("token"));
  if (!token.success) return { code: "NOT_FOUND" };
  const { error } = await createAdminClient().rpc("cancel_guest_booking", {
    p_token: token.data,
  });
  if (error) return { code: publicError(error) };
  redirect("/stay/" + token.data);
}
