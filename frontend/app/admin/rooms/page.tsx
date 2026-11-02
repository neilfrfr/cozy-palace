import { saveRoomTypeAction } from "@/app/actions/inventory";
import { ClosureSection } from "@/components/closure-section";
import { InventoryNotice } from "@/components/inventory-notice";
import { getAdminRooms, getClosures } from "@/lib/inventory/service";
export const dynamic = "force-dynamic";
export default async function RoomInventory({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ notice, error }, rooms, closures] = await Promise.all([
    searchParams,
    getAdminRooms(),
    getClosures(),
  ]);
  const types = [
    ...new Map(rooms.map((r) => [r.room_types.id, r.room_types])).values(),
  ];
  return (
    <>
      <p className="eyebrow">INVENTORY</p>
      <h1>Rooms</h1>
      <p className="intro">
        Rates and capacity are set per room type. Changes apply to new bookings
        only; existing bookings keep the rate they were made at. Every change is
        recorded in the activity log.
      </p>
      <InventoryNotice notice={notice} error={error} />
      <h2>Room types</h2>
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Room types</caption>
          <thead>
            <tr>
              <th>Type code</th>
              <th>Name</th>
              <th>Rooms</th>
              <th>Guests and nightly rate</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td>{t.code}</td>
                <td>{t.name}</td>
                <td>
                  {rooms
                    .filter((r) => r.room_types.id === t.id)
                    .map((r) => r.room_number)
                    .join(", ")}
                </td>
                <td>
                  <form action={saveRoomTypeAction} className="inline-form">
                    <input type="hidden" name="id" value={t.id} />
                    <label>
                      Guests
                      <input
                        name="capacity"
                        type="number"
                        required
                        min={1}
                        max={20}
                        defaultValue={t.capacity}
                      />
                    </label>
                    <label>
                      Nightly rate (₱)
                      <input
                        name="rate"
                        type="number"
                        required
                        min={0}
                        max={1000000}
                        step="0.01"
                        defaultValue={t.nightly_rate}
                      />
                    </label>
                    <button className="button">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!types.length && <p className="empty">No rooms have been added.</p>}
      </div>
      <ClosureSection
        page="/admin/rooms"
        noun="Room"
        resources={rooms.map((r) => ({
          id: r.id,
          label: `Room ${r.room_number} (${r.room_types.name})`,
        }))}
        closures={closures.filter((c) => c.room_id)}
      />
    </>
  );
}
