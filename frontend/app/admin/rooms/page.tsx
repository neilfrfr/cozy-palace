import { getAdminRooms } from "@/lib/inventory/service";
export default async function RoomInventory() {
  const rooms = await getAdminRooms();
  return (
    <>
      <p className="eyebrow">INVENTORY</p>
      <h1>Rooms</h1>
      <p className="intro">
        Room types, rates and operational states from your inventory.
      </p>
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Room inventory</caption>
          <thead>
            <tr>
              <th>Room</th>
              <th>Type code</th>
              <th>Name</th>
              <th>Capacity</th>
              <th>Nightly rate</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td>{room.room_number}</td>
                <td>{room.room_types.code}</td>
                <td>{room.room_types.name}</td>
                <td>{room.room_types.capacity}</td>
                <td>
                  ₱
                  {Number(room.room_types.nightly_rate).toLocaleString("en-PH")}
                </td>
                <td>
                  <span className={"status " + room.operational_state}>
                    {room.operational_state.replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rooms.length && <p className="empty">No rooms have been added.</p>}
      </div>
      <p className="notice">
        Inventory is read-only in this prototype. Changes are managed by the
        database administrator.
      </p>
    </>
  );
}
