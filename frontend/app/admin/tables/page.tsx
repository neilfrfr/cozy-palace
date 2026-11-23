import {
  createTableAction,
  saveTableAction,
} from "@/app/actions/inventory";
import { ClosureSection } from "@/components/closure-section";
import { InventoryNotice } from "@/components/inventory-notice";
import { requireStaff } from "@/lib/auth/authorize";
import { getClosures, getDiningTables } from "@/lib/inventory/service";
import { planSpot } from "@/lib/floor-plan";
export const dynamic = "force-dynamic";
export default async function TableInventory({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireStaff(true);
  const [{ notice, error }, tables, closures] = await Promise.all([
    searchParams,
    getDiningTables(),
    getClosures(),
  ]);
  return (
    <>
      <p className="eyebrow">INVENTORY</p>
      <h1>Restaurant Tables</h1>
      <p className="intro">
        Seats per table. Existing bookings are not changed, and every change is
        recorded in the activity log.
      </p>
      <InventoryNotice notice={notice} error={error} />
      <div className="admin-split">
        <section className="panel-card" aria-labelledby="seats">
          <h2 id="seats">Seats per table</h2>
          <form action={createTableAction} className="inventory-create-form">
            <label>
              Table number
              <input name="number" required maxLength={30} />
            </label>
            <label>
              Seats
              <input
                name="capacity"
                type="number"
                required
                min={1}
                max={20}
                step={1}
              />
            </label>
            <button className="button">Add table</button>
          </form>
          {tables.length ? (
            <ul className="capacity-grid">
              {[...tables].sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true, sensitivity: "base" })).map((table) => (
                <li key={table.id}>
                  <form action={saveTableAction}>
                    <input type="hidden" name="id" value={table.id} />
                    <span className="table-badge">{table.table_number}</span>
                    <label>
                      <span className="hidden-label">
                        Seats at table {table.table_number}
                      </span>
                      <input
                        name="capacity"
                        type="number"
                        required
                        min={1}
                        max={20}
                        defaultValue={table.capacity}
                      />
                    </label>
                    <button className="button">Save</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No restaurant tables have been added.</p>
          )}
          {tables.some((t) => !planSpot(t.table_number)) && (
            <p className="subtle">
              Not on the guest floor plan:{" "}
              {tables
                .filter((t) => !planSpot(t.table_number))
                .map((t) => t.table_number)
                .join(", ")}
              . Guests see these listed under the plan and can book them the
              same way.
            </p>
          )}
        </section>
        <ClosureSection
          page="/admin/tables"
          noun="Table"
          resources={tables.map((t) => ({
            id: t.id,
            label: `Table ${t.table_number} (${t.capacity} seats)`,
          }))}
          closures={closures.filter((c) => c.table_id)}
        />
      </div>
    </>
  );
}
