import Image from "next/image";
export function RoomPhoto({
  name,
  inCard = false,
}: {
  name: string;
  inCard?: boolean;
}) {
  return (
    <div className={inCard ? "room-photo room-photo-card" : "room-photo"}>
      <Image
        src="/design/hotel-hero.jpg"
        alt=""
        fill
        sizes="(max-width: 760px) 100vw, (max-width: 1050px) 50vw, 33vw"
        className="room-photo-image"
      />
      <span className="room-photo-label">Cozy Palace property preview</span>
      <span className="hidden-label">Room photography for {name} is not available yet.</span>
    </div>
  );
}
