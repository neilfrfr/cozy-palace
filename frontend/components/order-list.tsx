import {
  markOrderPaidAction,
  transitionOrderAction,
} from "@/app/actions/orders";
import { PayToggle } from "@/components/pay-toggle";
import { bookedAt, formatLabel } from "@/lib/format";
import { Fragment } from "react";
import { paymentMethods, peso, type Order } from "@/lib/orders";

export const methodLabel = (m: string) =>
  m === "gcash" ? "GCash" : formatLabel(m);

/** Orders with their item snapshots; staff also get Complete/Cancel on open orders. */
export function OrderList({
  rows,
  staff = false,
}: {
  rows: Order[];
  staff?: boolean;
}) {
  if (!rows.length) return <p className="empty">No orders yet.</p>;
  return (
    <div className="table-wrap orders-table">
      <table>
        <caption className="hidden-label">Orders</caption>
        <thead>
          <tr>
            <th>Order</th>
            <th>Ordered on</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th>Payment</th>
            {staff && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const payable = staff && !o.paid_at && !o.rooms && o.status !== "cancelled";
            return (
            <Fragment key={o.id}>
            <tr>
              <td>
                <strong>{o.reference}</strong>
                {o.reservations && (
                  <div className="subtle">For {o.reservations.reference}</div>
                )}
                {o.reservations?.guest_full_name && <div className="subtle">{o.reservations.guest_full_name}</div>}
                {o.reservations?.customer?.full_name && <div className="subtle">{o.reservations.customer.full_name}</div>}
                {o.rooms && (
                  <div className="subtle">
                    Charged to room {o.rooms.room_number}
                  </div>
                )}
                {staff && o.staff && (
                  <div className="subtle">Entered by {o.staff.full_name}</div>
                )}
                {staff && o.note && <div className="subtle">{o.note}</div>}
              </td>
              <td>{bookedAt(o.created_at)}</td>
              <td>
                <details className="order-items-details">
                  <summary>{o.order_items.slice(0, 2).map((i) => `${i.quantity} × ${i.name}`).join(", ")}{o.order_items.length > 2 ? ` +${o.order_items.length - 2} more` : ""}</summary>
                  <div className="order-items-expanded">{o.order_items.map((i) => <div key={i.name}>{i.quantity} × {i.name} <span className="subtle">({peso(i.unit_price)})</span></div>)}</div>
                </details>
              </td>
              <td>{peso(o.total)}</td>
              <td>
                <span
                  className={
                    "status " + (o.status === "open" ? "pending" : o.status)
                  }
                >
                  {formatLabel(o.status)}
                </span>
              </td>
              <td>
                {o.paid_at ? (
                  <>
                    <span className="status confirmed">Paid</span>
                    <div className="subtle">
                      {methodLabel(o.payment_method!)}
                      {o.payment_reference && " · " + o.payment_reference}
                    </div>
                  </>
                ) : o.status === "cancelled" ? (
                  "—"
                ) : (
                  <span className="status pending">
                    {o.rooms ? "On room bill" : "Unpaid"}
                  </span>
                )}
              </td>
              {staff && (
                <td>
                  {(payable || o.status === "open") &&
                    <div className="order-transition-actions">
                    {payable && <PayToggle target={"pay-" + o.id} />}
                    {o.status === "open" && (["completed", "cancelled"] as const)
                      .filter((s) => s === "completed" || !o.paid_at)
                      .map((s) => (
                        <form key={s} action={transitionOrderAction}>
                          <input type="hidden" name="id" value={o.id} />
                          <input
                            type="hidden"
                            name="version"
                            value={o.version}
                          />
                          <input type="hidden" name="status" value={s} />
                          <button
                            className={
                              s === "completed" ? "button" : "button secondary"
                            }
                          >
                            {s === "completed" ? "Complete" : "Cancel"}
                          </button>
                        </form>
                      ))}
                    </div>}
                </td>
              )}
            </tr>
            {payable && (
              <tr id={"pay-" + o.id} className="order-pay-row" hidden>
                <td colSpan={7}>
                  <form action={markOrderPaidAction} className="inline-form order-payment-actions">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="version" value={o.version} />
                    <strong>Payment for order {o.reference}</strong>
                    <label>
                      Method
                      <select name="method" defaultValue="cash">
                        {paymentMethods.map((m) => (
                          <option key={m} value={m}>
                            {methodLabel(m)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Reference (optional)
                      <input name="reference" maxLength={100} />
                    </label>
                    <button className="button">Confirm payment</button>
                  </form>
                </td>
              </tr>
            )}
            </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
