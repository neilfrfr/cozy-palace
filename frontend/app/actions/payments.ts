"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isConfigured } from "@/lib/supabase/config";
import { guestLinkToken } from "@/lib/operations/schema";
import { publicError } from "@/lib/reservations/errors";
import { createCheckout, paymongoKey } from "@/lib/payments/paymongo";
/** Signed-in customers send the reservation id; visitors send their booking-link token. */
export async function startCheckoutAction(
  _: { code: string } | null,
  form: FormData,
): Promise<{ code: string }> {
  const id = z.uuid().safeParse(form.get("id"));
  const token = guestLinkToken.safeParse(form.get("token"));
  if (!id.success && !token.success) return { code: "INVALID_INPUT" };
  const key = paymongoKey();
  if (!key || !isConfigured()) return { code: "PAYMENT_UNAVAILABLE" };
  const { data, error } = token.success
    ? await createAdminClient().rpc("open_guest_payment", {
        p_token: token.data,
      })
    : await (
        await createClient()
      ).rpc("open_payment", { p_reservation_id: id.data });
  if (error) return { code: publicError(error) };
  const p = data as { id: string; amount: number; reference: string };
  let url: string;
  try {
    url = await createCheckout(key, {
      paymentId: p.id,
      returnPath: token.success
        ? `/stay/${token.data}`
        : `/reservations/${id.data}/checkout`,
      reference: p.reference,
      amount: p.amount,
    });
  } catch {
    return { code: "PAYMENT_UNAVAILABLE" };
  }
  redirect(url);
}
