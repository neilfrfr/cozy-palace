import {
  readPaidInvoice,
  readRefund,
  verifyToken,
  xenditKey,
} from "@/lib/payments/xendit";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  if (!xenditKey()) return new Response(null, { status: 503 });
  if (
    !verifyToken(
      request.headers.get("x-callback-token"),
      process.env.XENDIT_WEBHOOK_TOKEN!,
    )
  )
    return new Response(null, { status: 401 });
  const body = await request.text();
  // Invoice and refund callbacks share this URL; refunds carry an "event" field.
  const refund = readRefund(body);
  if (refund === "INVALID") return new Response(null, { status: 422 });
  if (refund) {
    const { error } = await createAdminClient().rpc("settle_refund", {
      p_refund_id: refund.refundId,
      p_status: refund.status,
      p_provider_refund_id: refund.providerRefundId,
      p_failure_code: refund.failureCode,
    });
    if (error?.message === "NOT_FOUND")
      return new Response(null, { status: 200 });
    if (error) {
      console.error("settle_refund failed", error.message);
      return new Response(null, { status: 500 });
    }
    return new Response(null, { status: 200 });
  }
  const paid = readPaidInvoice(body);
  if (paid === "INVALID") return new Response(null, { status: 422 });
  if (!paid) return new Response(null, { status: 200 });
  const { data, error } = await createAdminClient().rpc("record_payment", {
    p_payment_id: paid.paymentId,
    p_provider_payment_id: paid.providerPaymentId,
    p_amount: paid.amount,
    p_currency: paid.currency,
  });
  // An invoice opened against another environment's database (or Xendit's dashboard test callback): nothing to retry.
  if (error?.message === "NOT_FOUND")
    return new Response(null, { status: 200 });
  // Anything else is retried by Xendit.
  if (error) {
    console.error("record_payment failed", error.message);
    return new Response(null, { status: 500 });
  }
  if (data === "review")
    console.warn("Payment needs staff review", paid.paymentId);
  return new Response(null, { status: 200 });
}
