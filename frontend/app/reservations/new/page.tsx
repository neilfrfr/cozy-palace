import { randomUUID } from "node:crypto";
import { requireCustomer } from "@/lib/auth/authorize";
import { getBookedNightsByRoom, getRooms } from "@/lib/reservations/service";
import { businessDate } from "@/lib/operations/schema";
import { ReservationForm } from "@/components/reservation-form";
import { WorkspaceNav } from "@/components/workspace-nav";
export const dynamic = "force-dynamic";
export default async function NewReservation({
  searchParams,
}: {
  searchParams: Promise<{
    room?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  }>;
}) {
  const defaults = await searchParams;
  const safe = Object.fromEntries(
    Object.entries(defaults).filter(
      (v): v is [string, string] => typeof v[1] === "string",
    ),
  );
  await requireCustomer("/reservations/new?" + new URLSearchParams(safe));
  const rooms = await getRooms();
  const bookedNights = await getBookedNightsByRoom(rooms);
  return (
    <>
      <WorkspaceNav />
      <h1>Plan your stay</h1>
      <p className="intro">
        Save a draft, review your details, then send your booking request.
      </p>
      <ReservationForm
        rooms={rooms}
        defaults={defaults}
        requestKey={randomUUID()}
        bookedNights={bookedNights}
        today={businessDate()}
      />
    </>
  );
}
