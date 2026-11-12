"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/lib/auth/authorize";
import { deliverNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isConfigured } from "@/lib/supabase/config";
import { publicError } from "@/lib/reservations/errors";
import { createCheckout, createRefund, xenditKey } from "@/lib/payments/xendit";
import { parseRefundAmount } from "@/lib/payments/ledger";
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
  const p = data as {
    id: string;
    amount: number;
    reference: string;
    checkout_url: string | null;
  };
  // The booking's invoice is still live: send the customer back to it, never open a second one.
  if (p.checkout_url) redirect(p.checkout_url);
  let checkout: Awaited<ReturnType<typeof createCheckout>>;
  try {
    checkout = await createCheckout(key, {
      paymentId: p.id,
      returnPath: `/reservations/${id.data}/checkout`,
      reference: p.reference,
      amount: p.amount,
    });
  } catch {
    return { code: "PAYMENT_UNAVAILABLE" };
  }
  const { error: saveError } = await createAdminClient().rpc("save_checkout", {
    p_payment_id: p.id,
    p_checkout_url: checkout.url,
    p_expires_at: checkout.expiresAt,
  });
  // The invoice works anyway; the next click would just open a fresh one.
  if (saveError)
    console.error("Saving the checkout link failed", saveError.message);
  redirect(checkout.url);
}
/** Any staff member sends a full or partial refund through Xendit. It stays pending until Xendit's callback settles it. */
export async function refundAction(form: FormData) {
  const { db } = await requireStaff();
  const id = z.uuid().safeParse(form.get("id"));
  const amount = parseRefundAmount(form.get("amount"));
  if (!id.success || amount === null)
    redirect("/staff/payments?error=INVALID_AMOUNT");
  const key = xenditKey();
  if (!key) redirect("/staff/payments?error=PAYMENT_UNAVAILABLE");
  const { data, error } = await db.rpc("request_refund", {
    p_payment_id: id.data,
    p_amount: amount,
  });
  function done(query: string): never {
    for (const p of ["/staff/payments", "/admin/activity"]) revalidatePath(p);
    redirect("/staff/payments?" + query);
  }
  if (error) {
    const code = publicError(error);
    done("error=" + (code === "INVALID_INPUT" ? "INVALID_AMOUNT" : code));
  }
  const refund = data as {
    id: string;
    invoice_id: string;
    amount: number;
    booking_status: string;
  };
  let sent: Awaited<ReturnType<typeof createRefund>>;
  try {
    sent = await createRefund(key, {
      refundId: refund.id,
      invoiceId: refund.invoice_id,
      amount: refund.amount,
      reason: ["cancelled", "expired"].includes(refund.booking_status)
        ? "CANCELLATION"
        : "OTHERS",
    });
  } catch (e) {
    // Xendit may still have taken it: leave it pending for the callback rather than risk a second refund.
    console.error("Xendit refund request failed", e);
    done("error=REFUND_UNCONFIRMED");
  }
  if (sent.status === "FAILED") {
    const { error: settleError } = await createAdminClient().rpc(
      "settle_refund",
      {
        p_refund_id: refund.id,
        p_status: "failed",
        p_provider_refund_id: null,
        p_failure_code: sent.code,
      },
    );
    if (settleError)
      console.error(
        "Recording the rejected refund failed",
        settleError.message,
      );
    done("error=REFUND_REJECTED&code=" + encodeURIComponent(sent.code));
  }
  done("notice=refund_sent");
}
/** Records a refund staff already sent from the Xendit dashboard. */
export async function markRefundedAction(form: FormData) {
  const { db } = await requireStaff();
  const id = z.uuid().safeParse(form.get("id"));
  const reference = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .safeParse(form.get("reference"));
  if (!id.success || !reference.success)
    redirect("/staff/payments?error=INVALID_INPUT");
  const { error } = await db.rpc("mark_payment_refunded", {
    p_payment_id: id.data,
    p_reference: reference.data,
  });
  for (const p of ["/staff/payments", "/admin/activity"]) revalidatePath(p);
  if (!error) after(() => deliverNotifications());
  redirect(
    "/staff/payments?" +
      (error ? "error=" + publicError(error) : "notice=refunded"),
  );
}
