import Image from "next/image";
import Link from "next/link";
import type { Room } from "@/lib/reservations/types";
import { roomPhoto } from "@/lib/room-photos";

// Room types without their own photo zoom into a different part of the
// property photo, so neighbouring tiles don't look identical.
const framing = [
  { scale: 1.15, origin: "30% 70%" },
  { scale: 1.6, origin: "85% 20%" },
  { scale: 1.5, origin: "10% 85%" },
  { scale: 1.8, origin: "60% 45%" },
];

/** Full-bleed photo tile used for the room showcase on the home page. */
export function RoomTile({ room, index }: { room: Room; index: number }) {
  const photo = roomPhoto(room.room_types.name);
  const crop = photo ? { scale: 1, origin: "center" } : framing[index % framing.length];
  return (
    <article className="room-tile">
      <div
        className="room-tile-media"
        style={
          {
            "--crop-scale": crop.scale,
            "--crop-origin": crop.origin,
          } as React.CSSProperties
        }
      >
        <Image
          src={photo ?? "/design/hotel-hero.jpg"}
          alt=""
          fill
          sizes="(max-width: 760px) 100vw, 50vw"
          className="room-tile-image"
        />
      </div>
      <div className="room-tile-copy">
        <h3>{room.room_types.name}</h3>
        <p>
          Up to {room.room_types.capacity} guests, from ₱
          {Number(room.room_types.nightly_rate).toLocaleString("en-PH")} a night
        </p>
        <Link className="button outline-light" href={`/rooms/${room.id}`}>
          View room<span className="hidden-label"> {room.room_number}</span>
        </Link>
      </div>
    </article>
  );
}
