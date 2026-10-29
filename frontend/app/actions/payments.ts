"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { publicError } from "@/lib/reservations/errors";
import { createCheckout, paymongoKey } from "@/lib/payments/paymongo";
/** Online payment is for signed-in customers; visitors without an account pay through staff. */
export async function startCheckoutAction(
  _: { code: string } | null,
  form: FormData,
): Promise<{ code: string }> {
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { code: "INVALID_INPUT" };
  const key = paymongoKey();
  if (!key || !isConfigured()) return { code: "PAYMENT_UNAVAILABLE" };
  const { data, error } = await (
    await createClient()
  ).rpc("open_payment", { p_reservation_id: id.data });
  if (error) return { code: publicError(error) };
  const p = data as { id: string; amount: number; reference: string };
  let url: string;
  try {
    url = await createCheckout(key, {
      paymentId: p.id,
      returnPath: `/reservations/${id.data}/checkout`,
      reference: p.reference,
      amount: p.amount,
    });
  } catch {
    return { code: "PAYMENT_UNAVAILABLE" };
  }
  redirect(url);
}
