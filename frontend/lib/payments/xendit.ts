import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { siteOrigin } from "@/lib/accounts/site-url";

/** The Xendit secret key, or null when payments are off. Production keys only ever run in Vercel Production. */
export function xenditKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const key = env.XENDIT_SECRET_KEY;
  if (!key || !env.XENDIT_WEBHOOK_TOKEN || !env.SUPABASE_SECRET_KEY)
    return null;
  if (key.startsWith("xnd_production_") && env.VERCEL_ENV !== "production")
    return null;
  return key.startsWith("xnd_production_") ||
    key.startsWith("xnd_development_")
    ? key
    : null;
}

/** Opens a Xendit hosted invoice; the methods shown (GCash, Maya, cards) are the ones enabled in the Xendit dashboard. */
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
  const res = await fetch("https://api.xendit.co/v2/invoices", {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // The webhook matches the payment by this id.
      external_id: p.paymentId,
      amount: Number(p.amount),
      currency: "PHP",
      description: `Cozy Palace reservation ${p.reference}`,
      success_redirect_url: back + "?paid=1",
      failure_redirect_url: back,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error("XENDIT_" + res.status);
  const url = (await res.json())?.invoice_url;
  if (typeof url !== "string" || !url.startsWith("https://"))
    throw new Error("XENDIT_RESPONSE");
  return url;
}

/** Xendit sends the dashboard's webhook verification token as x-callback-token. Replays are no-ops in record_payment. */
export function verifyToken(header: string | null, token: string): boolean {
  if (!header || !token) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const paidInvoice = z.object({
  id: z.string().min(1).max(100),
  external_id: z.uuid(),
  status: z.enum(["PAID", "SETTLED"]),
  paid_amount: z.number().positive(),
  currency: z.string().max(3),
});

/** The paid invoice in a verified callback, null for other statuses, or "INVALID" when unreadable. */
export function readPaidInvoice(body: string) {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return "INVALID" as const;
  }
  const status = (json as { status?: unknown })?.status;
  if (status !== "PAID" && status !== "SETTLED") return null;
  // Dashboard-made invoices and Xendit's "Test and save" sample are not ours: acknowledge, don't retry.
  if (!z.uuid().safeParse((json as { external_id?: unknown }).external_id).success)
    return null;
  const parsed = paidInvoice.safeParse(json);
  if (!parsed.success) return "INVALID" as const;
  return {
    paymentId: parsed.data.external_id,
    providerPaymentId: parsed.data.id,
    amount: parsed.data.paid_amount,
    currency: parsed.data.currency,
  };
}
