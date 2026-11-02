import { saveTableAction } from "@/app/actions/inventory";
import { ClosureSection } from "@/components/closure-section";
import { InventoryNotice } from "@/components/inventory-notice";
import { requireStaff } from "@/lib/auth/authorize";
import { getClosures, getDiningTables } from "@/lib/inventory/service";
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
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Restaurant table inventory</caption>
          <thead>
            <tr>
              <th>Table</th>
              <th>Seats</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <tr key={table.id}>
                <td>{table.table_number}</td>
                <td>
                  <form action={saveTableAction} className="inline-form">
                    <input type="hidden" name="id" value={table.id} />
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tables.length && (
          <p className="empty">No restaurant tables have been added.</p>
        )}
      </div>
      <ClosureSection
        page="/admin/tables"
        noun="Table"
        resources={tables.map((t) => ({
          id: t.id,
          label: `Table ${t.table_number} (${t.capacity} seats)`,
        }))}
        closures={closures.filter((c) => c.table_id)}
      />
    </>
  );
}
