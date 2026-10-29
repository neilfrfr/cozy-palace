// Stands in for PayMongo while sign-up is closed: signs a checkout_session.payment.paid
// event the same way PayMongo does and posts it to the running app's webhook.
// Usage: npm run simulate:payment -- CP-XXXXXXXXXXXX [amount-in-pesos] [--url http://localhost:3000]
// Click "Pay with PayMongo" on the reservation first: that opens the payment row this pays.
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(new URL("../.env.local", import.meta.url));
} catch {
  /* Variables may come from the shell instead. */
}
const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const base =
  urlFlag >= 0 ? args.splice(urlFlag, 2)[1] : "http://localhost:3000";
const [reference, amountArg] = args;
const env = process.env;
if (
  !reference ||
  !env.NEXT_PUBLIC_SUPABASE_URL ||
  !env.SUPABASE_SECRET_KEY ||
  !env.PAYMONGO_WEBHOOK_SECRET
) {
  console.error(
    "Usage: npm run simulate:payment -- <CP-reference> [amount]\nNeeds NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET in frontend/.env.local.",
  );
  process.exit(1);
}
// Sending a signed event to a deployed site would let anyone holding its secret confirm stays.
if (
  !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) &&
  !env.SIMULATE_ALLOW_REMOTE
) {
  console.error(
    "Refusing to post outside localhost. Set SIMULATE_ALLOW_REMOTE=1 for a Preview you control.",
  );
  process.exit(1);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data: reservation, error } = await db
  .from("reservations")
  .select("id,status,total,payments(id,amount,status,created_at)")
  .eq("reference", reference)
  .maybeSingle();
if (error || !reservation) {
  console.error(error?.message ?? `No reservation ${reference}.`);
  process.exit(1);
}
const payment = reservation.payments
  .filter((p) => p.status === "open")
  .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
if (!payment) {
  console.error(
    `${reference} has no open payment. Click "Pay with PayMongo" on its checkout page first.`,
  );
  process.exit(1);
}
const amount = Math.round(Number(amountArg ?? payment.amount) * 100);
const body = JSON.stringify({
  data: {
    id: "evt_sim_" + Date.now(),
    type: "event",
    attributes: {
      type: "checkout_session.payment.paid",
      livemode: false,
      data: {
        id: "cs_sim_" + Date.now(),
        type: "checkout_session",
        attributes: {
          reference_number: payment.id,
          payments: [
            {
              id: "pay_sim_" + payment.id,
              attributes: { amount, currency: "PHP", status: "paid" },
            },
          ],
        },
      },
    },
  },
});
const t = Math.floor(Date.now() / 1000);
const te = createHmac("sha256", env.PAYMONGO_WEBHOOK_SECRET)
  .update(`${t}.${body}`)
  .digest("hex");
const res = await fetch(new URL("/api/paymongo/webhook", base), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "paymongo-signature": `t=${t},te=${te},li=`,
  },
  body,
});
const after = await db
  .from("reservations")
  .select("status,payments(id,status,amount_paid)")
  .eq("id", reservation.id)
  .single();
const paid = after.data?.payments.find((p) => p.id === payment.id);
console.log(`Webhook answered ${res.status}.`);
console.log(
  `Reservation ${reference}: ${reservation.status} -> ${after.data?.status}`,
);
console.log(
  `Payment ${payment.id}: ${paid?.status} (paid ₱${paid?.amount_paid ?? "-"} of ₱${payment.amount})`,
);
