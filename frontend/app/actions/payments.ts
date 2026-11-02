"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/lib/auth/authorize";
import { deliverNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { publicError } from "@/lib/reservations/errors";
import { createCheckout, xenditKey } from "@/lib/payments/xendit";
/** Online payment is for signed-in customers; visitors without an account pay through staff. */
export async function startCheckoutAction(
  _: { code: string } | null,
  form: FormData,
): Promise<{ code: string }> {
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { code: "INVALID_INPUT" };
  const key = xenditKey();
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
/** Records a refund staff already sent from the Xendit dashboard. */
export async function markRefundedAction(form: FormData) {
  const { db } = await requireStaff();
  const id = z.uuid().safeParse(form.get("id"));
  const reference = z.string().trim().min(1).max(200).safeParse(form.get("reference"));
  if (!id.success || !reference.success)
    redirect("/staff/payments?error=INVALID_INPUT");
  const { error } = await db.rpc("mark_payment_refunded", {
    p_payment_id: id.data,
    p_reference: reference.data,
  });
  for (const p of ["/staff/payments", "/admin/activity"]) revalidatePath(p);
  if (!error) after(() => deliverNotifications());
  redirect("/staff/payments?" + (error ? "error=" + publicError(error) : "notice=refunded"));
}
