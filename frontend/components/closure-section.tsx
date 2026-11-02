import { addClosureAction, removeClosureAction } from "@/app/actions/inventory";
import type { Closure } from "@/lib/inventory/service";

const day = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    dateStyle: "medium",
  });

/** Date-range closures (repairs, private events) for rooms or tables; admins only. */
export function ClosureSection({
  page,
  noun,
  resources,
  closures,
}: {
  page: "/admin/rooms" | "/admin/tables";
  noun: "Room" | "Table";
  resources: { id: string; label: string }[];
  closures: Closure[];
}) {
  const label = new Map(resources.map((r) => [r.id, r.label]));
  return (
    <section aria-labelledby="closures">
      <h2 id="closures">Closed dates</h2>
      <p className="intro">
        A closed {noun.toLowerCase()} can&apos;t be booked from the first day up
        to, but not including, the reopening day. Dates that already have
        bookings can&apos;t be closed; move or cancel those bookings first.
      </p>
      <form action={addClosureAction} className="operations-filters">
        <input type="hidden" name="page" value={page} />
        <label>
          {noun}
          <select name="resource" required>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Closed from
          <input name="from" type="date" required />
        </label>
        <label>
          Reopens on
          <input name="to" type="date" required />
        </label>
        <label>
          Reason
          <input name="reason" required maxLength={200} placeholder="Repairs" />
        </label>
        <button className="button">Close dates</button>
      </form>
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Closed dates</caption>
          <thead>
            <tr>
              <th>{noun}</th>
              <th>Closed from</th>
              <th>Reopens on</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {closures.map((c) => (
              <tr key={c.id}>
                <td>{label.get((c.room_id ?? c.table_id)!) ?? "—"}</td>
                <td>{day(c.starts_on)}</td>
                <td>{day(c.ends_on)}</td>
                <td>{c.reason}</td>
                <td>
                  <form action={removeClosureAction}>
                    <input type="hidden" name="page" value={page} />
                    <input type="hidden" name="id" value={c.id} />
                    <button className="button secondary">Reopen</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!closures.length && <p className="empty">Nothing is closed.</p>}
      </div>
    </section>
  );
}
