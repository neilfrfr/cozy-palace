import { transitionOrderAction } from "@/app/actions/orders";
import { bookedAt, formatLabel } from "@/lib/format";
import { peso, type Order } from "@/lib/orders";

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
              {staff && (
                <td>
                  {o.status === "open" &&
                    (["completed", "cancelled"] as const).map((s) => (
                      <form key={s} action={transitionOrderAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="version" value={o.version} />
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
