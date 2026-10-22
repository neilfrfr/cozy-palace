import Image from "next/image";
import { roomPhoto } from "@/lib/room-photos";
export function RoomPhoto({
  name,
  inCard = false,
}: {
  name: string;
  inCard?: boolean;
}) {
  const src = roomPhoto(name);
  return (
    <div className={inCard ? "room-photo room-photo-card" : "room-photo"}>
      <Image
        src={src ?? "/design/hotel-hero.jpg"}
        alt={src ? name : ""}
        fill
        sizes="(max-width: 760px) 100vw, (max-width: 1050px) 50vw, 33vw"
        className="room-photo-image"
      />
      {!src && (
        <>
          <span className="room-photo-label">Cozy Palace property preview</span>
          <span className="hidden-label">Room photography for {name} is not available yet.</span>
        </>
      )}
    </div>
  );
}
