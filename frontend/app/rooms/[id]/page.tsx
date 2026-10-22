import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isConfigured } from "@/lib/supabase/config";
import { getRoom } from "@/lib/inventory/service";
import { SetupNotice } from "@/components/setup-notice";
import { RoomPhoto } from "@/components/room-photo";
export const dynamic = "force-dynamic";
export default async function RoomDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  if (!isConfigured())
    return (
      <>
        <h1>Room details</h1>
        <SetupNotice />
      </>
    );
  const [room, search] = await Promise.all([getRoom(id), searchParams]);
  if (!room) notFound();
  const query = new URLSearchParams({ room: room.id });
  for (const key of ["checkIn", "checkOut", "guests"] as const)
    if (typeof search[key] === "string") query.set(key, search[key]);
  return (
    <>
      <Link href="/rooms" className="back-link">
        ← All rooms
      </Link>
      <p className="eyebrow">
        {room.room_types.code} · Room {room.room_number}
      </p>
      <h1>{room.room_types.name}</h1>
      <p className="intro">{room.room_types.description}</p>
      <RoomPhoto name={room.room_types.name} />
      <div className="panel">
        <dl className="details">
          <div>
            <dt>Capacity</dt>
            <dd>Up to {room.room_types.capacity} guests</dd>
          </div>
          <div>
            <dt>Current nightly rate</dt>
            <dd>
              ₱{Number(room.room_types.nightly_rate).toLocaleString("en-PH")}
            </dd>
          </div>
          <div>
            <dt>Room number</dt>
            <dd>{room.room_number}</dd>
          </div>
          <div>
            <dt>Operational state</dt>
            <dd>{room.operational_state.replaceAll("_", " ")}</dd>
          </div>
        </dl>
        <p className="subtle">
          Your dates and price are reviewed before submission. Availability is
          checked when you send your request.
        </p>
        <div className="actions">
          {room.operational_state === "available" ? (
            <Link className="button gold" href={"/reservations/new?" + query}>
              Choose room
            </Link>
          ) : (
            <p className="notice">This room is currently out of service.</p>
          )}
          <Link href="/rooms" className="button secondary">
            Back to rooms
          </Link>
        </div>
      </div>
      <p className="subtle">
        Fictional prototype inventory and rates. Room photographs have not been
        supplied for this inventory.
      </p>
    </>
  );
}
