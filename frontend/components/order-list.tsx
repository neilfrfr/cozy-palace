import {
  markOrderPaidAction,
  transitionOrderAction,
} from "@/app/actions/orders";
import { bookedAt, formatLabel } from "@/lib/format";
import { paymentMethods, peso, type Order } from "@/lib/orders";

const methodLabel = (m: string) => (m === "gcash" ? "GCash" : formatLabel(m));

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
    <div className="table-wrap">
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
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{o.reference}</strong>
                {o.reservations && (
                  <div className="subtle">For {o.reservations.reference}</div>
                )}
                {staff && o.note && <div className="subtle">{o.note}</div>}
              </td>
              <td>{bookedAt(o.created_at)}</td>
              <td>
                {o.order_items.map((i) => (
                  <div key={i.name}>
                    {i.quantity} × {i.name}{" "}
                    <span className="subtle">({peso(i.unit_price)})</span>
                  </div>
                ))}
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
                  <span className="status pending">Unpaid</span>
                )}
              </td>
              {staff && (
                <td>
                  {!o.paid_at && o.status !== "cancelled" && (
                    <form action={markOrderPaidAction} className="inline-form">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="version" value={o.version} />
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
                      <button className="button">Mark paid</button>
                    </form>
                  )}
                  {o.status === "open" &&
                    (["completed", "cancelled"] as const)
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
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
