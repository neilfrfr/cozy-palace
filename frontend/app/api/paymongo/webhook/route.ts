import {
  paymongoKey,
  readPaidCheckout,
  verifySignature,
} from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const key = paymongoKey();
  if (!key) return new Response(null, { status: 503 });
  const body = await request.text();
  if (
    !verifySignature(
      request.headers.get("paymongo-signature"),
      body,
      process.env.PAYMONGO_WEBHOOK_SECRET!,
      key.startsWith("sk_live_"),
    )
  )
    return new Response(null, { status: 401 });
  const paid = readPaidCheckout(body);
  if (paid === "INVALID") return new Response(null, { status: 422 });
  if (!paid) return new Response(null, { status: 204 });
  const { data, error } = await createAdminClient().rpc("record_payment", {
    p_payment_id: paid.paymentId,
    p_provider_payment_id: paid.providerPaymentId,
    p_amount: paid.amount,
    p_currency: paid.currency,
  });
  // A checkout opened against another environment's database: nothing to retry.
  if (error?.message === "NOT_FOUND")
    return new Response(null, { status: 204 });
  // Anything else is retried by PayMongo.
  if (error) {
    console.error("record_payment failed", error.message);
    return new Response(null, { status: 500 });
  }
  if (data === "review")
    console.warn("Payment needs staff review", paid.paymentId);
  return new Response(null, { status: 204 });
}
