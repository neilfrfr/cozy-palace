import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { siteOrigin } from "@/lib/accounts/site-url";

/** The PayMongo secret key, or null when payments are off. Live keys only ever run in Production. */
export function paymongoKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const key = env.PAYMONGO_SECRET_KEY;
  if (!key || !env.PAYMONGO_WEBHOOK_SECRET || !env.SUPABASE_SECRET_KEY)
    return null;
  if (key.startsWith("sk_live_") && env.VERCEL_ENV !== "production")
    return null;
  return key.startsWith("sk_live_") || key.startsWith("sk_test_") ? key : null;
}

export const centavos = (amount: number) => Math.round(Number(amount) * 100);

export async function createCheckout(
  key: string,
  p: {
    paymentId: string;
    /** Same-site path the customer returns to, e.g. /reservations/<id>/checkout. */
    returnPath: string;
    reference: string;
    amount: number;
  },
): Promise<string> {
  const origin = siteOrigin();
  if (!origin) throw new Error("SETUP_REQUIRED");
  const back = origin + p.returnPath;
  const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: `Cozy Palace reservation ${p.reference}`,
              amount: centavos(p.amount),
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: ["gcash", "paymaya", "card"],
          // The webhook matches the payment by this id.
          reference_number: p.paymentId,
          success_url: back + "?paid=1",
          cancel_url: back,
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error("PAYMONGO_" + res.status);
  const url = (await res.json())?.data?.attributes?.checkout_url;
  if (typeof url !== "string" || !url.startsWith("https://"))
    throw new Error("PAYMONGO_RESPONSE");
  return url;
}

/**
 * Paymongo-Signature is `t=<unix>,te=<hex>,li=<hex>`: HMAC-SHA256 of `t.rawBody`.
 * No timestamp window: retries may reuse t, and replays are no-ops in record_payment.
 */
export function verifySignature(
  header: string | null,
  body: string,
  secret: string,
  live: boolean,
): boolean {
  const parts: Record<string, string> = {};
  for (const part of (header ?? "").split(",")) {
    const i = part.indexOf("=");
    if (i > 0) parts[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const sig = live ? parts.li : parts.te;
  if (!parts.t || !sig) return false;
  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.${body}`)
    .digest("hex");
  return (
    sig.length === expected.length &&
    timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  );
}

const paidEvent = z.object({
  data: z.object({
    attributes: z.object({
      type: z.literal("checkout_session.payment.paid"),
      data: z.object({
        attributes: z.object({
          reference_number: z.uuid(),
          payments: z
            .array(
              z.object({
                id: z.string().min(1).max(100),
                attributes: z.object({
                  amount: z.number().int().positive(),
                  currency: z.string().max(3),
                }),
              }),
            )
            .min(1),
        }),
      }),
    }),
  }),
});

/** The paid checkout in a verified event, null for other event types, or "INVALID" when unreadable. */
export function readPaidCheckout(body: string) {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return "INVALID" as const;
  }
  const type = (json as { data?: { attributes?: { type?: unknown } } })?.data
    ?.attributes?.type;
  if (type !== "checkout_session.payment.paid") return null;
  const parsed = paidEvent.safeParse(json);
  if (!parsed.success) return "INVALID" as const;
  const session = parsed.data.data.attributes.data.attributes;
  const payment = session.payments[0];
  return {
    paymentId: session.reference_number,
    providerPaymentId: payment.id,
    amount: payment.attributes.amount / 100,
    currency: payment.attributes.currency,
  };
}
