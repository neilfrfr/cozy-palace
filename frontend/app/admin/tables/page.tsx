import { requireStaff } from "@/lib/auth/authorize";
import { getDiningTables } from "@/lib/inventory/service";
export default async function TableInventory() {
  await requireStaff(true);
  const tables = await getDiningTables();
  return (
    <>
      <p className="eyebrow">INVENTORY</p>
      <h1>Restaurant tables</h1>
      <p className="intro">Seating capacity and operational states.</p>
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Restaurant table inventory</caption>
          <thead>
            <tr>
              <th>Table</th>
              <th>Capacity</th>
              <th>Operational state</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <tr key={table.id}>
                <td>{table.table_number}</td>
                <td>{table.capacity}</td>
                <td>
                  <span className={"status " + table.operational_state}>
                    {table.operational_state.replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tables.length && (
          <p className="empty">No restaurant tables have been added.</p>
        )}
      </div>
      <p className="notice">
        Inventory is read-only. Online dining booking and time-slot availability
        are not available yet.
      </p>
    </>
  );
}
