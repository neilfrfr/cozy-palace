import { readPaidInvoice, verifyToken, xenditKey } from "@/lib/payments/xendit";
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
  const paid = readPaidInvoice(await request.text());
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
