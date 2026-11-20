"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/lib/auth/authorize";
import { deliverNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/client-ip";
import { lookupSchema } from "@/lib/operations/schema";
import { isConfigured } from "@/lib/supabase/config";
import { publicError } from "@/lib/reservations/errors";
import { createCheckout, createRefund, xenditKey } from "@/lib/payments/xendit";
import { parseRefundAmount } from "@/lib/payments/ledger";
import { paymentMethods } from "@/lib/orders";
/** Online payment for a signed-in customer's own booking. */
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
  return openInvoice(key, data as Opened, `/reservations/${id.data}/checkout`);
}
type Opened = {
  id: string;
  amount: number;
  reference: string;
  checkout_url: string | null;
  hold_expires_at: string | null;
};
/** Sends the payer to the booking's live invoice, or opens a new one on Xendit. */
async function openInvoice(
  key: string,
  p: Opened,
  returnPath: string,
): Promise<{ code: string }> {
  // The booking's invoice is still live: send the payer back to it, never open a second one.
  if (p.checkout_url) redirect(p.checkout_url);
  // Leave enough time to pay inside the hold; a payment after it ends needs a refund.
  if (
    p.hold_expires_at &&
    Date.parse(p.hold_expires_at) - Date.now() < 15 * 60_000
  )
    return { code: "HOLD_ENDING" };
  let checkout: Awaited<ReturnType<typeof createCheckout>>;
  try {
    checkout = await createCheckout(key, {
      paymentId: p.id,
      returnPath,
      reference: p.reference,
      amount: p.amount,
      holdEndsAt: p.hold_expires_at,
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
/** Visitors without an account pay by giving the same name and booking number as Find a Reservation. */
export async function startGuestCheckoutAction(
  _: { code: string } | null,
  form: FormData,
): Promise<{ code: string }> {
  const p = lookupSchema.safeParse({
    first: form.get("first"),
    last: form.get("last"),
    reference: form.get("reference"),
  });
  if (!p.success) return { code: "INVALID_INPUT" };
  const key = xenditKey();
  if (!key || !adminConfigured()) return { code: "PAYMENT_UNAVAILABLE" };
  const { data, error } = await createAdminClient().rpc("open_guest_payment", {
    p_first_name: p.data.first,
    p_last_name: p.data.last,
    p_reference: p.data.reference,
    p_client_ip: await clientIp(),
  });
  if (error) return { code: publicError(error) };
  return openInvoice(key, data as Opened, "/find-reservation");
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

/** Money taken at the desk: the whole balance or a deposit. */
export async function recordDeskPaymentAction(form: FormData) {
  const { db } = await requireStaff();
  const p = z
    .object({
      id: z.uuid(),
      method: z.enum(paymentMethods),
      reference: z.string().trim().max(100),
    })
    .safeParse({
      id: form.get("id"),
      method: form.get("method"),
      reference: form.get("reference") ?? "",
    });
  const amount = parseRefundAmount(form.get("amount"));
  const back = "/staff/reservations/" + (p.success ? p.data.id : "");
  if (!p.success || amount === null) redirect(back + "?error=INVALID_PAYMENT");
  const { error } = await db.rpc("record_desk_payment", {
    p_reservation_id: p.data.id,
    p_amount: amount,
    p_method: p.data.method,
    p_reference: p.data.reference,
  });
  for (const path of [back, "/staff/payments", "/admin/activity"])
    revalidatePath(path);
  if (!error) after(() => deliverNotifications());
  const code = error && publicError(error);
  const shown: Record<string, string> = {
    INVALID_INPUT: "INVALID_PAYMENT",
    INVALID_TRANSITION: "PAYMENT_CLOSED",
  };
  redirect(
    back +
      "?" +
      (code ? "error=" + (shown[code] ?? code) : "notice=payment_recorded"),
  );
}

/** Accept a review payment as paid toward its booking. */
export async function verifyPaymentAction(form: FormData) {
  const { db } = await requireStaff();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/staff/payments?error=INVALID_INPUT");
  const { error } = await db.rpc("verify_payment", { p_payment_id: id.data });
  for (const p of ["/staff/payments", "/admin/activity"]) revalidatePath(p);
  if (!error) after(() => deliverNotifications());
  const code = error && publicError(error);
  redirect(
    "/staff/payments?" +
      (code
        ? "error=" + (code === "INVALID_AMOUNT" ? "INVALID_AMOUNT_VERIFY" : code)
        : "notice=verified"),
  );
}
