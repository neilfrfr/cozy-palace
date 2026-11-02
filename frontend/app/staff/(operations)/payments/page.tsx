import Link from "next/link";
import { getLedger, refundable, type LedgerPayment } from "@/lib/payments/ledger";
import { markRefundedAction } from "@/app/actions/payments";
import { bookedAt, formatLabel } from "@/lib/format";
import { peso } from "@/lib/orders";
export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  refunded: "Payment marked as refunded and logged in the activity log.",
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
                  <form action={markRefundedAction} className="inline-form">
                    <input type="hidden" name="id" value={p.id} />
                    <label>
                      <span className="hidden-label">
                        Xendit refund ID or note for {p.reservations.reference}
                      </span>
                      <input
                        name="reference"
                        required
                        maxLength={200}
                        placeholder="Xendit refund ID"
                      />
                    </label>
                    <button className="button secondary">Mark refunded</button>
                  </form>
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
            Every online payment. Refunds are sent from the Xendit dashboard;
            mark the payment refunded here afterwards so it is recorded and
            logged.
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
