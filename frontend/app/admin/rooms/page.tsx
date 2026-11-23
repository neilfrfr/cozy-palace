import {
  createRoomAction,
  createRoomTypeAction,
  deleteRoomAction,
  deleteRoomTypeAction,
  saveRoomAction,
  saveRoomTypeAction,
} from "@/app/actions/inventory";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ClosureSection } from "@/components/closure-section";
import { InventoryNotice } from "@/components/inventory-notice";
import { MenuPhotoPicker } from "@/components/menu-photo-picker";
import { AddCard, colLabel, SectionCard } from "@/components/admin-ui";
import {
  getAdminRooms,
  getAdminRoomTypes,
  getClosures,
} from "@/lib/inventory/service";
export const dynamic = "force-dynamic";
export default async function RoomInventory({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ notice, error }, rooms, types, closures] = await Promise.all([
    searchParams,
    getAdminRooms(),
    getAdminRoomTypes(),
    getClosures(),
  ]);
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
      <div className="admin-split rooms-split">
        <div className="rooms-main">
          <AddCard title="Add a room type">
            {/* Same layout as the menu add form: photo on the left, fields on the right. */}
            <form action={createRoomTypeAction} className="menu-add-form">
              <MenuPhotoPicker id="room-type-add-photo" />
              <div className="menu-add-fields">
                <label>
                  Name
                  <input name="name" required maxLength={100} />
                </label>
                <label>
                  Guests
                  <input name="capacity" type="number" required min={1} max={20} step={1} />
                </label>
                <label>
                  Nightly rate (₱)
                  <input name="rate" type="number" required min={0} max={1000000} step="0.01" />
                </label>
                <label className="menu-add-description">
                  Description
                  <input name="description" maxLength={500} />
                </label>
                <div className="menu-add-end">
                  <button className="button">Add room type</button>
                </div>
              </div>
            </form>
          </AddCard>
          <SectionCard
            title="Room types"
            count={types.length}
            head={["Name", "Guests", "Nightly rate (₱)", "Actions"]}
            cols="minmax(0,1.6fr) minmax(0,.55fr) minmax(0,.9fr) auto"
          >
            {types.map((t) => (
              <form key={t.id} action={saveRoomTypeAction} className="edit-row room-type-row">
                <input type="hidden" name="id" value={t.id} />
                <label>
                  {colLabel("Name", true)}
                  <input name="name" required maxLength={100} defaultValue={t.name} />
                  <small className="row-caption">
                    {t.code} · Rooms{" "}
                    {rooms
                      .filter((r) => r.room_types.id === t.id)
                      .map((r) => r.room_number)
                      .join(", ") || "none yet"}
                  </small>
                </label>
                <label className="edit-line">
                  {colLabel("Description", true)}
                  <textarea name="description" maxLength={500} rows={2} placeholder="Description" defaultValue={t.description} />
                </label>
                <label>
                  {colLabel("Guests", true)}
                  <input name="capacity" type="number" required min={1} max={20} defaultValue={t.capacity} />
                </label>
                <label>
                  {colLabel("Nightly rate (₱)", true)}
                  <input name="rate" type="number" required min={0} max={1000000} step="0.01" defaultValue={t.nightly_rate} />
                </label>
                <div className="admin-item-actions">
                  <button className="button">Save</button>
                  <ConfirmDeleteButton
                    action={deleteRoomTypeAction}
                    title={`Delete ${t.name}?`}
                    message="Room types with rooms cannot be deleted. Their photo and description are removed if deletion is allowed."
                  />
                </div>
              </form>
            ))}
          </SectionCard>
        </div>
        <div className="rooms-side">
          <section className="panel-card" aria-labelledby="rooms">
            <h2 id="rooms">
              Rooms <span className="count-chip">{rooms.length}</span>
            </h2>
            <form action={createRoomAction} className="inventory-create-form room-create">
              <label>
                Room number
                <input name="number" required maxLength={30} />
              </label>
              <label>
                Room type
                <select name="typeId" required defaultValue="" disabled={!types.length}>
                  <option value="" disabled>
                    Choose a room type
                  </option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.code})
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" disabled={!types.length}>
                Add room
              </button>
            </form>
            {!types.length && <p className="subtle">Add a room type before adding a room.</p>}
            <p className="subtle">Room types cannot be changed on rooms with booking history.</p>
            {rooms.map((room) => (
              <form key={room.id} action={saveRoomAction} className="room-row">
                <input type="hidden" name="id" value={room.id} />
                <label>
                  <span className="hidden-label">Room number</span>
                  <input name="number" required maxLength={30} defaultValue={room.room_number} />
                </label>
                <label>
                  <span className="hidden-label">Room type for room {room.room_number}</span>
                  <select name="typeId" defaultValue={room.room_types.id} required>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-item-actions">
                  <button className="button">Save</button>
                  <ConfirmDeleteButton
                    action={deleteRoomAction}
                    title={`Delete room ${room.room_number}?`}
                    message="Rooms with booking or room charge history are kept and cannot be deleted."
                  />
                </div>
              </form>
            ))}
            {!rooms.length && <p className="empty">No rooms have been added.</p>}
          </section>
          <ClosureSection
            page="/admin/rooms"
            noun="Room"
            resources={rooms.map((r) => ({
              id: r.id,
              label: `Room ${r.room_number} (${r.room_types.name})`,
            }))}
            closures={closures.filter((c) => c.room_id)}
          />
        </div>
      </div>
    </>
  );
}
