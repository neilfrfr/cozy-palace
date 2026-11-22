import { addClosureAction, removeClosureAction } from "@/app/actions/inventory";
import type { Closure } from "@/lib/inventory/service";
import { DatePicker } from "@/components/date-picker";

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
    <section aria-labelledby="closures" className="panel-card">
      <h2 id="closures">Closed dates</h2>
      <p className="subtle">Dates with bookings can&apos;t be closed. The reopening date is not included.</p>
      <form action={addClosureAction} className="closure-form">
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
        <DatePicker name="from" label="Closed from" required />
        <DatePicker name="to" label="Reopens on" required />
        <label>
          Reason
          <input name="reason" required maxLength={200} placeholder="Repairs" />
        </label>
        <button className="button closure-submit">Close dates</button>
      </form>
      {/* A list, not a table: the card can be narrow, and a table cut off its Reopen column. */}
      {closures.length ? (
        <ul className="closure-list">
          {closures.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{label.get((c.room_id ?? c.table_id)!) ?? "—"}</strong>
                <span>
                  {day(c.starts_on)} to {day(c.ends_on)}
                </span>
                <small>{c.reason}</small>
              </div>
              <form action={removeClosureAction}>
                <input type="hidden" name="page" value={page} />
                <input type="hidden" name="id" value={c.id} />
                <button className="button secondary">Reopen</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty closure-empty">Nothing is closed.</p>
      )}
    </section>
  );
}
