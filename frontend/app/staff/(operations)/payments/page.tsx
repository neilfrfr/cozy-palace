import Link from "next/link";
import {
  getLedger,
  refundable,
  refundPending,
  remainingRefundable,
  type LedgerPayment,
} from "@/lib/payments/ledger";
import { markRefundedAction, refundAction } from "@/app/actions/payments";
import { RefundButton } from "@/components/refund-button";
import { bookedAt, formatLabel } from "@/lib/format";
import { peso } from "@/lib/orders";
export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  refunded: "Payment marked as refunded and logged in the activity log.",
  refund_sent:
    "Refund sent to Xendit. It shows as pending until Xendit confirms it, usually within minutes.",
  INVALID_AMOUNT:
    "Enter an amount above ₱0 with up to two decimals, no more than what is left to refund.",
  REFUND_PENDING:
    "A refund for this payment is already pending with Xendit. Wait for it to be confirmed before sending another.",
  REFUND_UNCONFIRMED:
    "Xendit did not answer. The refund stays pending until Xendit confirms it; check the Xendit dashboard before trying anything else.",
  REFUND_REJECTED:
    "Xendit rejected this refund, so nothing was sent. Check the Xendit dashboard, or refund there and mark it refunded below.",
  PAYMENT_UNAVAILABLE: "Xendit is not set up on this site.",
  INVALID_INPUT: "Enter the Xendit refund ID or a short note (up to 200 characters).",
  INVALID_TRANSITION:
    "This payment cannot be marked refunded. Cancel the booking first, or refresh: it may already be refunded.",
  NOT_FOUND: "This payment could not be found.",
  FORBIDDEN: "Only staff can record refunds.",
};

function PaymentTable({ rows, caption }: { rows: LedgerPayment[]; caption: string }) {
  return (
    <div className="table-wrap payments-table">
      <table>
        <caption className="hidden-label">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Booking</th>
            <th scope="col">Guest</th>
            <th scope="col">Amount</th>
            <th scope="col">Payment</th>
            <th scope="col">Refund</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={"/staff/reservations/" + p.reservations.id}>
                  {p.reservations.reference}
                </Link>
                <br />
                <small>Booking {formatLabel(p.reservations.status).toLowerCase()}</small>
              </td>
              <td className="wrap">
                {p.reservations.guest_full_name ??
                  p.reservations.customer?.full_name ??
                  "Unavailable"}
              </td>
              <td>
                {peso(Number(p.amount_paid ?? p.amount))}
                {p.amount_paid != null && Number(p.amount_paid) !== Number(p.amount) && (
                  <>
                    <br />
                    <small>Expected {peso(Number(p.amount))}</small>
                  </>
                )}
              </td>
              <td>
                <span className={"status " + p.status}>
                  {p.status === "open" ? "Checkout opened" : formatLabel(p.status)}
                </span>
                <br />
                <small>{bookedAt(p.paid_at ?? p.created_at)}</small>
              </td>
              <td className="wrap refund">
                {p.status === "refunded" ? (
                  <>
                    {p.refund_reference}
                    <br />
                    <small>
                      {p.refunder?.full_name ?? "Staff"}
                      <br />
                      {bookedAt(p.refunded_at!)}
                    </small>
                  </>
                ) : refundable(p) ? (
                  <>
                    {remainingRefundable(p) < Number(p.amount_paid) && (
                      <small>
                        {peso(remainingRefundable(p))} of{" "}
                        {peso(Number(p.amount_paid))} left to refund
                        <br />
                      </small>
                    )}
                    {refundPending(p) ? (
                      <p>
                        <span className="status pending">Refund pending</span>
                        <br />
                        <small>Waiting for Xendit to confirm.</small>
                      </p>
                    ) : (
                      p.provider_payment_id && (
                        <form action={refundAction} className="inline-form">
                          <input type="hidden" name="id" value={p.id} />
                          <label>
                            <span className="hidden-label">
                              Amount to refund for {p.reservations.reference}
                            </span>
                            <input
                              name="amount"
                              type="number"
                              required
                              min={0.01}
                              step={0.01}
                              max={remainingRefundable(p)}
                              defaultValue={remainingRefundable(p)}
                            />
                          </label>
                          <RefundButton />
                        </form>
                      )
                    )}
                    <details>
                      <summary>
                        Already refunded in the Xendit dashboard?
                      </summary>
                      <form action={markRefundedAction} className="inline-form">
                        <input type="hidden" name="id" value={p.id} />
                        <label>
                          <span className="hidden-label">
                            Xendit refund ID or note for{" "}
                            {p.reservations.reference}
                          </span>
                          <input
                            name="reference"
                            required
                            maxLength={200}
                            placeholder="Xendit refund ID"
                          />
                        </label>
                        <button className="button secondary">
                          Mark refunded
                        </button>
                      </form>
                    </details>
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Payments({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ notice, error }, { payments, needsRefund }] = await Promise.all([
    searchParams,
    getLedger(),
  ]);
  const message = messages[error ?? notice ?? ""];
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>Payments</h1>
          <p>
            Every online payment. Refund a cancelled booking&apos;s payment, in
            full or in part, with Refund via Xendit. If you refunded from the
            Xendit dashboard instead, mark the payment refunded here so it is
            recorded and logged.
          </p>
        </div>
      </header>
      {message && (
        <p className={"notice" + (error ? " error" : "")} role={error ? "alert" : "status"}>
          {message}
        </p>
      )}
      <section className="operations-section">
        <h2>Needs refund ({needsRefund.length})</h2>
        <p className="subtle">
          Paid or review payments on cancelled or expired bookings. GCash
          refunds must be sent within 180 days, Maya within 365.
        </p>
        {needsRefund.length ? (
          <PaymentTable rows={needsRefund} caption="Payments that need a refund" />
        ) : (
          <p className="empty">Nothing to refund.</p>
        )}
      </section>
      <section className="operations-section">
        <h2>All payments</h2>
        <PaymentTable rows={payments} caption="All payments, newest first" />
        {payments.length === 0 && <p className="empty">No payments yet.</p>}
      </section>
    </>
  );
}
