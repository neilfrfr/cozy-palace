import "server-only";
import { requireStaff } from "@/lib/auth/authorize";

export type LedgerPayment = {
  id: string;
  status: "open" | "paid" | "review" | "refunded";
  amount: number;
  amount_paid: number | null;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  refund_reference: string | null;
  refunder: { full_name: string } | null;
  provider_payment_id: string | null;
  refunds: { amount: number; status: "pending" | "succeeded" | "failed" }[];
  reservations: {
    id: string;
    reference: string;
    status: string;
    guest_full_name: string | null;
    customer: { full_name: string } | null;
  };
};

const columns =
  "id,status,amount,amount_paid,created_at,paid_at,refunded_at,refund_reference,provider_payment_id,refunds(amount,status),refunder:profiles!payments_refunded_by_fkey(full_name),reservations!inner(id,reference,status,guest_full_name,customer:profiles!reservations_customer_id_fkey(full_name))";

/** Mirrors private.mark_payment_refunded; the database re-checks. */
export const refundable = (p: LedgerPayment) =>
  p.status === "review" ||
  (p.status === "paid" &&
    ["cancelled", "expired"].includes(p.reservations.status));

export const refundPending = (p: LedgerPayment) =>
  p.refunds.some((r) => r.status === "pending");

/** Paid amount not yet sent back through Xendit, in pesos (two decimals). Mirrors private.request_refund. */
export const remainingRefundable = (p: LedgerPayment) =>
  Math.round(
    p.refunds.reduce(
      (left, r) =>
        r.status === "succeeded" ? left - Number(r.amount) * 100 : left,
      Number(p.amount_paid ?? 0) * 100,
    ),
  ) / 100;

/** A peso amount with at most two decimals, above zero and at most `max`; null otherwise. The database re-checks. */
export function parseRefundAmount(input: unknown, max = Infinity) {
  const text = String(input ?? "").trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return amount > 0 && amount <= max ? amount : null;
}

export async function getLedger() {
  const { db } = await requireStaff();
  const [all, due] = await Promise.all([
    // shortcut: newest 200 only, add paging when the hotel takes more than that between reviews.
    db
      .from("payments")
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("payments")
      .select(columns)
      .in("status", ["paid", "review"])
      .in("reservations.status", ["cancelled", "expired"])
      .order("paid_at", { ascending: true }),
  ]);
  if (all.error || due.error) throw Error("Payments could not be loaded.");
  return {
    payments: all.data as unknown as LedgerPayment[],
    needsRefund: due.data as unknown as LedgerPayment[],
  };
}
