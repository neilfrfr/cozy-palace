import Link from "next/link";
import { RoomPhoto } from "@/components/room-photo";
import type { Room } from "@/lib/reservations/types";
export function RoomCard({ room, query = "" }: { room: Room; query?: string }) {
  return (
    <article className="room">
      <RoomPhoto name={room.room_types.name} inCard />
      <div className="room-card-top">
        <span className="eyebrow">{room.room_types.code}</span>
        <span className="room-number">Room {room.room_number}</span>
      </div>
      <h2>{room.room_types.name}</h2>
      <p>{room.room_types.description}</p>
      <p className="subtle">Up to {room.room_types.capacity} guests</p>
      <div className="room-bottom">
        <div className="price">
          ₱{Number(room.room_types.nightly_rate).toLocaleString("en-PH")}{" "}
          <small>/ night</small>
        </div>
        <Link
          className="button secondary"
          href={`/rooms/${room.id}${query ? "?" + query : ""}`}
        >
          View room<span className="hidden-label"> {room.room_number}</span>
        </Link>
      </div>
    </article>
  );
}
