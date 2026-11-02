// Stands in for Xendit's invoice callback: posts a PAID invoice with the webhook token
// the same way Xendit does, to the running app's webhook.
// Usage: npm run simulate:payment -- CP-XXXXXXXXXXXX [amount-in-pesos] [--url http://localhost:3000]
// Click "Pay with Xendit" on the reservation first: that opens the payment row this pays.
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
  !env.XENDIT_WEBHOOK_TOKEN
) {
  console.error(
    "Usage: npm run simulate:payment -- <CP-reference> [amount]\nNeeds NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and XENDIT_WEBHOOK_TOKEN in frontend/.env.local.",
  );
  process.exit(1);
}
// Sending a signed event to a deployed site would let anyone holding its token confirm stays.
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
    `${reference} has no open payment. Click "Pay with Xendit" on its checkout page first.`,
  );
  process.exit(1);
}
const body = JSON.stringify({
  id: "inv_sim_" + Date.now(),
  external_id: payment.id,
  status: "PAID",
  amount: Number(payment.amount),
  paid_amount: Number(amountArg ?? payment.amount),
  currency: "PHP",
  payment_method: "EWALLET",
  payment_channel: "GCASH",
});
const res = await fetch(new URL("/api/xendit/webhook", base), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-callback-token": env.XENDIT_WEBHOOK_TOKEN,
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
